const fs = require('fs')
const path = require('path')
const { resolveSuiteRunDir, rootDir } = require('./reconciliation-suite-paths.cjs')

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function normalizeRelative(value) {
  if (!value) return ''
  return String(value).replace(/\\/g, '/')
}

function toRunRelative(runDir, filePath) {
  if (!filePath) return ''
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(runDir, filePath)
  return normalizeRelative(path.relative(runDir, resolved))
}

function toRootRelative(filePath) {
  if (!filePath) return ''
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath)
  return normalizeRelative(path.relative(rootDir, resolved))
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return []

  const files = []
  const stack = [dirPath]

  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.isFile()) {
        files.push(fullPath)
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b))
}

function collectSummaryRows(summaryPayload) {
  const summary = summaryPayload?.summary
  if (!summary) return []

  return [
    ...(summary.passes ?? []),
    ...(summary.pendingUiReview ?? []),
    ...(summary.runtimePathValidations ?? []),
    ...(summary.failures ?? []),
    ...(summary.blocked ?? []),
    ...(summary.notRecorded ?? []),
  ]
}

function collectScenarioResultRows(runDir) {
  const scenarioResultsDir = path.join(runDir, 'scenario-results')
  const rows = new Map()

  for (const filePath of listFiles(scenarioResultsDir)) {
    if (path.extname(filePath).toLowerCase() !== '.json') continue
    const payload = readJsonIfExists(filePath)
    const scenarioId = payload?.scenarioId
    if (!scenarioId) continue

    rows.set(scenarioId, {
      scenarioId,
      title: payload.title ?? '',
      lane: payload.lane ?? '',
      status: payload.status ?? '',
      reason: payload.reason ?? '',
      notes: Array.isArray(payload.notes) ? payload.notes.join(' | ') : payload.notes ?? '',
      executionMode: payload.execution?.mode ?? '',
      flowId: payload.execution?.flowId ?? '',
      depositId: payload.execution?.depositId ?? '',
      lineId: payload.execution?.lineId ?? '',
      scheduleIds: Array.isArray(payload.execution?.scheduleIds)
        ? payload.execution.scheduleIds.join('|')
        : payload.execution?.scheduleIds ?? '',
      scenarioResultPath: toRunRelative(runDir, filePath),
      artifactPaths: Array.isArray(payload.artifacts)
        ? payload.artifacts.map(artifact => artifact.path).filter(Boolean).join('|')
        : '',
    })
  }

  return rows
}

function collectResultAttachments(resultsJson) {
  const byScenarioId = new Map()

  function visit(node, inheritedTitle = []) {
    if (!node || typeof node !== 'object') return

    const titleParts = Array.isArray(node.titlePath)
      ? node.titlePath
      : node.title
        ? [...inheritedTitle, node.title]
        : inheritedTitle
    const titleText = titleParts.join(' ')
    const scenarioId = titleText.match(/\[(RS-\d+)\]/)?.[1]

    if (scenarioId && Array.isArray(node.results)) {
      for (const result of node.results) {
        for (const attachment of result.attachments ?? []) {
          if (!attachment?.path) continue
          if (!byScenarioId.has(scenarioId)) byScenarioId.set(scenarioId, [])
          byScenarioId.get(scenarioId).push({
            name: attachment.name ?? '',
            contentType: attachment.contentType ?? '',
            path: attachment.path,
          })
        }
      }
    }

    for (const key of ['suites', 'specs', 'tests']) {
      if (!Array.isArray(node[key])) continue
      for (const child of node[key]) visit(child, titleParts)
    }
  }

  visit(resultsJson)
  return byScenarioId
}

function splitArtifactPaths(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value)
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function classifyAttachmentPaths(runDir, attachments, scenarioRow) {
  const artifactPaths = splitArtifactPaths(scenarioRow.artifactPaths)
  const artifactDirs = artifactPaths
    .map(artifactPath => path.dirname(path.resolve(runDir, artifactPath)))
    .filter(dirPath => fs.existsSync(dirPath))

  const filesFromArtifactDirs = artifactDirs.flatMap(dirPath => listFiles(dirPath))
  const attachmentFiles = attachments.map(attachment => attachment.path).filter(Boolean)
  const candidates = unique([...attachmentFiles, ...filesFromArtifactDirs])

  const videoPaths = []
  const tracePaths = []
  const screenshotPaths = []
  const dataAttachmentPaths = []

  for (const candidate of candidates) {
    const absolutePath = path.isAbsolute(candidate) ? candidate : path.resolve(runDir, candidate)
    const relativePath = toRunRelative(runDir, absolutePath)
    const extension = path.extname(absolutePath).toLowerCase()

    if (['.webm', '.mp4'].includes(extension)) {
      videoPaths.push(relativePath)
    } else if (extension === '.zip' && path.basename(absolutePath).toLowerCase().includes('trace')) {
      tracePaths.push(relativePath)
    } else if (['.png', '.jpg', '.jpeg'].includes(extension)) {
      screenshotPaths.push(relativePath)
    } else if (extension === '.json') {
      dataAttachmentPaths.push(relativePath)
    }
  }

  for (const artifactPath of artifactPaths) {
    const extension = path.extname(artifactPath).toLowerCase()
    if (['.png', '.jpg', '.jpeg'].includes(extension)) {
      screenshotPaths.push(toRunRelative(runDir, artifactPath))
    }
  }

  return {
    videoPaths: unique(videoPaths),
    tracePaths: unique(tracePaths),
    screenshotPaths: unique(screenshotPaths),
    dataAttachmentPaths: unique(dataAttachmentPaths),
  }
}

function buildMarkdown(index) {
  const lines = [
    `# Reconciliation Video Index`,
    ``,
    `Run ID: ${index.runId}`,
    `Generated At: ${index.generatedAt}`,
    `Run Directory: ${index.runDir}`,
    ``,
    `## Summary`,
    ``,
    `- Total scenarios: ${index.summary.totalScenarios}`,
    `- Scenarios with videos: ${index.summary.scenariosWithVideos}`,
    `- Scenarios with traces: ${index.summary.scenariosWithTraces}`,
    `- Scenarios with screenshots: ${index.summary.scenariosWithScreenshots}`,
    ``,
    `## Scenarios`,
    ``,
    `| Scenario | Status | Title | Videos | Traces | Screenshots |`,
    `| --- | --- | --- | ---: | ---: | ---: |`,
  ]

  for (const scenario of index.scenarios) {
    lines.push(
      `| ${scenario.scenarioId} | ${scenario.status} | ${String(scenario.title).replace(/\|/g, '\\|')} | ${scenario.videoPaths.length} | ${scenario.tracePaths.length} | ${scenario.screenshotPaths.length} |`
    )
  }

  lines.push('')
  return `${lines.join('\n')}\n`
}

function buildCsv(index) {
  const headers = [
    'scenarioId',
    'title',
    'lane',
    'status',
    'executionMode',
    'flowId',
    'videoPaths',
    'tracePaths',
    'screenshotPaths',
    'scenarioResultPath',
    'notes',
  ]

  const rows = index.scenarios.map(scenario =>
    headers.map(header => csvEscape(scenario[header])).join(',')
  )

  return `${headers.join(',')}\n${rows.join('\n')}\n`
}

function main() {
  const runArg = process.argv[2] ?? process.env.PLAYWRIGHT_RUN_DIR ?? process.env.PLAYWRIGHT_RUN_ID
  const runDir = resolveSuiteRunDir(runArg)
  const runMetadata = readJsonIfExists(path.join(runDir, 'run-metadata.json')) ?? {}
  const summaryPayload = readJsonIfExists(path.join(runDir, 'reconciliation-summary.json')) ?? {}
  const resultsJson = readJsonIfExists(path.join(runDir, 'results.json')) ?? {}
  const scenarioResults = collectScenarioResultRows(runDir)
  const resultAttachments = collectResultAttachments(resultsJson)

  const rowsByScenarioId = new Map()
  for (const row of collectSummaryRows(summaryPayload)) {
    rowsByScenarioId.set(row.scenarioId, { ...row })
  }
  for (const [scenarioId, row] of scenarioResults.entries()) {
    rowsByScenarioId.set(scenarioId, { ...(rowsByScenarioId.get(scenarioId) ?? {}), ...row })
  }

  const scenarios = [...rowsByScenarioId.values()]
    .filter(row => row.scenarioId)
    .sort((a, b) => String(a.scenarioId).localeCompare(String(b.scenarioId)))
    .map(row => {
      const attachments = resultAttachments.get(row.scenarioId) ?? []
      const classified = classifyAttachmentPaths(runDir, attachments, row)

      return {
        scenarioId: row.scenarioId,
        title: row.title ?? '',
        group: row.group ?? '',
        lane: row.lane ?? '',
        status: row.status ?? '',
        validationScope: row.validationScope ?? '',
        reason: row.reason ?? '',
        executionMode: row.executionMode ?? '',
        flowId: row.flowId ?? '',
        depositId: row.depositId ?? '',
        lineId: row.lineId ?? '',
        scheduleIds: row.scheduleIds ?? '',
        notes: row.notes ?? '',
        scenarioResultPath: row.scenarioResultPath ?? '',
        videoPaths: classified.videoPaths,
        tracePaths: classified.tracePaths,
        screenshotPaths: classified.screenshotPaths,
        dataAttachmentPaths: classified.dataAttachmentPaths,
      }
    })

  const index = {
    runId: runMetadata.runId ?? path.basename(runDir),
    suiteName: runMetadata.suiteName ?? 'reconciliation-suite',
    generatedAt: new Date().toISOString(),
    runDir: toRootRelative(runDir),
    absoluteRunDir: runDir,
    reportPath: fs.existsSync(path.join(runDir, 'html', 'index.html'))
      ? toRunRelative(runDir, path.join(runDir, 'html', 'index.html'))
      : '',
    summary: {
      totalScenarios: scenarios.length,
      scenariosWithVideos: scenarios.filter(scenario => scenario.videoPaths.length > 0).length,
      scenariosWithTraces: scenarios.filter(scenario => scenario.tracePaths.length > 0).length,
      scenariosWithScreenshots: scenarios.filter(scenario => scenario.screenshotPaths.length > 0).length,
    },
    scenarios,
  }

  writeJson(path.join(runDir, 'video-index.json'), index)
  fs.writeFileSync(path.join(runDir, 'video-index.csv'), buildCsv(index), 'utf8')
  fs.writeFileSync(path.join(runDir, 'video-index.md'), buildMarkdown(index), 'utf8')

  console.log(`Generated video index for ${index.runId}`)
  console.log(`Scenarios: ${index.summary.totalScenarios}`)
  console.log(`With videos: ${index.summary.scenariosWithVideos}`)
  console.log(`With traces: ${index.summary.scenariosWithTraces}`)
  console.log(`Index: ${path.join(runDir, 'video-index.md')}`)
}

main()
