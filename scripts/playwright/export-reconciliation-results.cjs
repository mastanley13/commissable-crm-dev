const fs = require('fs')
const path = require('path')
const {
  artifactsRoot,
  listSuiteRunDirs,
  resolveSuiteRunDir,
  suiteLatestPath,
} = require('./reconciliation-suite-paths.cjs')

const rootDir = path.resolve(__dirname, '..', '..')
const historyDir = path.join(artifactsRoot, 'history')
const latestRunPath = path.join(artifactsRoot, 'latest-run.json')
const manifestPath = path.join(
  rootDir,
  'docs',
  'plans',
  '04-01-2026-Reconciliation_Master_Test_Plan',
  'generated',
  'scenario-manifest.json'
)

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function listRunDirectories() {
  if (!fs.existsSync(historyDir)) return []

  return fs
    .readdirSync(historyDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(historyDir, entry.name))
    .sort((a, b) => path.basename(b).localeCompare(path.basename(a)))
}

function countScenarioResults(runDir) {
  const resultsDir = path.join(runDir, 'scenario-results')
  if (!fs.existsSync(resultsDir)) return 0
  return fs.readdirSync(resultsDir).filter(name => name.endsWith('.json')).length
}

function hasScenarioResults(runDir) {
  return countScenarioResults(runDir) > 0
}

function getManifestScenarioCount() {
  return readJson(manifestPath).scenarios.length
}

function resolveRunDir(runArg) {
  const manifestScenarioCount = getManifestScenarioCount()

  if (runArg) {
    try {
      return resolveSuiteRunDir(runArg)
    } catch {
      // Fall through to the legacy/general history resolution below.
    }

    const explicitPath = path.isAbsolute(runArg) ? runArg : path.resolve(rootDir, runArg)
    const historyPath = path.join(historyDir, runArg)

    if (fs.existsSync(explicitPath)) return explicitPath
    if (fs.existsSync(historyPath)) return historyPath

    throw new Error(`Could not resolve run "${runArg}".`)
  }

  if (process.env.PLAYWRIGHT_RUN_DIR && fs.existsSync(process.env.PLAYWRIGHT_RUN_DIR)) {
    return path.resolve(process.env.PLAYWRIGHT_RUN_DIR)
  }

  if (fs.existsSync(suiteLatestPath)) {
    const latestSuite = readJson(suiteLatestPath)
    if (latestSuite.runDir && fs.existsSync(latestSuite.runDir)) {
      return latestSuite.runDir
    }
  }

  const latestSuiteRun = listSuiteRunDirs().find(hasScenarioResults)
  if (latestSuiteRun) return latestSuiteRun

  if (fs.existsSync(latestRunPath)) {
    const latestRun = readJson(latestRunPath)
    if (latestRun.runDir && countScenarioResults(latestRun.runDir) === manifestScenarioCount) {
      return latestRun.runDir
    }
  }

  const candidateRuns = listRunDirectories()
    .map(runDir => ({ runDir, count: countScenarioResults(runDir) }))
    .filter(row => row.count > 0)

  const fullScenarioRun = candidateRuns.find(row => row.count === manifestScenarioCount)
  if (fullScenarioRun) return fullScenarioRun.runDir

  if (candidateRuns.length > 0) {
    return candidateRuns.sort((left, right) => right.count - left.count)[0].runDir
  }

  throw new Error('No Playwright history run with scenario results was found.')
}

function parseArgs(argv) {
  const args = { run: null }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === '--run') {
      args.run = argv[index + 1] ?? null
      index += 1
    } else if (!args.run) {
      args.run = current
    }
  }

  return args
}

function csvCell(value) {
  const stringValue = value == null ? '' : String(value)
  return `"${stringValue.replace(/"/g, '""')}"`
}

function toPublicRunMetadata(runMetadata) {
  if (!runMetadata) {
    return null
  }

  return {
    runId: runMetadata.runId,
    suiteName: runMetadata.suiteName,
    startedAt: runMetadata.startedAt ?? null,
    finishedAt: runMetadata.finishedAt ?? null,
    exitCode: runMetadata.exitCode ?? null,
    environmentLabel: runMetadata.environmentLabel ?? 'local',
    fixtureVersion: runMetadata.fixtureVersion ?? 'unspecified',
    scenarioManifestGeneratedAt: runMetadata.scenarioManifestGeneratedAt ?? null,
    scenarioCount: runMetadata.scenarioCount ?? null,
    isFullSuiteRun: Boolean(runMetadata.isFullSuiteRun),
    statusCounts: runMetadata.statusCounts ?? null,
  }
}

function summarizeReasons(rows, statuses) {
  const counts = new Map()

  for (const row of rows) {
    if (!statuses.has(row.status)) continue
    const key = row.reason || 'No reason provided'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => ({ reason, count }))
}

function loadRows(runDir) {
  const manifest = readJson(manifestPath)
  const resultsDir = path.join(runDir, 'scenario-results')
  const resultFiles = fs
    .readdirSync(resultsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => path.join(resultsDir, entry.name))

  const resultsByScenarioId = new Map(
    resultFiles.map(filePath => {
      const parsed = readJson(filePath)
      return [parsed.scenarioId, parsed]
    })
  )

  return manifest.scenarios.map(scenario => {
    const result = resultsByScenarioId.get(scenario.scenarioId)
    const scenarioValidationScope =
      scenario.execution.mode === 'browser-live'
        ? scenario.execution.validationScope ?? 'scenario-proof'
        : 'scenario-proof'
    const resultValidationScope =
      result?.execution?.mode === 'browser-live'
        ? result.execution.validationScope ?? scenarioValidationScope
        : scenarioValidationScope

    return {
      scenarioId: scenario.scenarioId,
      group: scenario.group,
      title: scenario.title,
      lane: scenario.lane,
      status: result?.status ?? 'not-recorded',
      validationScope: resultValidationScope,
      reason: result?.reason ?? '',
      notes: (result?.notes ?? []).join(' | '),
      executionMode: scenario.execution.mode,
      flowId: scenario.execution.mode === 'browser-live' ? scenario.execution.flowId : '',
      depositId: scenario.execution.mode === 'browser-live' ? scenario.execution.depositId : '',
      lineId: scenario.execution.mode === 'browser-live' ? scenario.execution.lineId : '',
      scheduleIds:
        scenario.execution.mode === 'browser-live'
          ? scenario.execution.scheduleIds.join('|')
          : '',
      artifactPaths: (result?.artifacts ?? []).map(artifact => artifact.path).join('|'),
    }
  })
}

function buildSummary(rows) {
  const statusCounts = rows.reduce((accumulator, row) => {
    accumulator[row.status] = (accumulator[row.status] ?? 0) + 1
    return accumulator
  }, {})

  const laneCounts = rows.reduce((accumulator, row) => {
    accumulator[row.lane] = (accumulator[row.lane] ?? 0) + 1
    return accumulator
  }, {})

  return {
    total: rows.length,
    statusCounts,
    laneCounts,
    passes: rows.filter(row => row.status === 'pass' && row.validationScope !== 'runtime-path-validation'),
    pendingUiReview: rows.filter(
      row => row.status === 'pass-pending-ui-review' && row.validationScope !== 'runtime-path-validation'
    ),
    runtimePathValidations: rows.filter(
      row =>
        row.validationScope === 'runtime-path-validation' &&
        (row.status === 'pass' || row.status === 'pass-pending-ui-review')
    ),
    failures: rows.filter(row => row.status === 'fail'),
    blocked: rows.filter(row => row.status === 'blocked'),
    notRecorded: rows.filter(row => row.status === 'not-recorded'),
    failureReasons: summarizeReasons(rows, new Set(['fail'])),
    blockedReasons: summarizeReasons(rows, new Set(['blocked'])),
  }
}

function writeCsv(filePath, rows) {
  const header = [
    'scenarioId',
    'group',
    'title',
    'lane',
    'status',
    'validationScope',
    'reason',
    'executionMode',
    'flowId',
    'depositId',
    'lineId',
    'scheduleIds',
    'notes',
    'artifactPaths',
  ]

  const lines = [
    header.join(','),
    ...rows.map(row =>
      [
        row.scenarioId,
        row.group,
        row.title,
        row.lane,
        row.status,
        row.validationScope,
        row.reason,
        row.executionMode,
        row.flowId,
        row.depositId,
        row.lineId,
        row.scheduleIds,
        row.notes,
        row.artifactPaths,
      ]
        .map(csvCell)
        .join(',')
    ),
  ]

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

function writeMarkdown(filePath, runId, summary) {
  const lines = [
    '# Reconciliation Scenario Export',
    '',
    `Run ID: ${runId}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Totals',
    '',
    `- Total scenarios: ${summary.total}`,
    `- Pass: ${summary.statusCounts.pass ?? 0}`,
    `- Pass-pending-ui-review: ${summary.statusCounts['pass-pending-ui-review'] ?? 0}`,
    `- Fail: ${summary.statusCounts.fail ?? 0}`,
    `- Blocked: ${summary.statusCounts.blocked ?? 0}`,
    `- Not recorded: ${summary.statusCounts['not-recorded'] ?? 0}`,
    `- Runtime-path validations: ${summary.runtimePathValidations.length}`,
    '',
    '## Lanes',
    '',
    `- @deterministic: ${summary.laneCounts['deterministic'] ?? 0}`,
    `- @ui-review: ${summary.laneCounts['ui-review'] ?? 0}`,
    `- @needs-clarification: ${summary.laneCounts['needs-clarification'] ?? 0}`,
    `- @known-bug: ${summary.laneCounts['known-bug'] ?? 0}`,
    '',
    '## Interpretation',
    '',
    '- `pass`: automated assertions completed successfully.',
    '- `pass-pending-ui-review`: the deterministic/browser evidence was good enough to proceed, but a human operator still needs to review the decision point or final allocation.',
    '- `blocked`: the scenario was intentionally not claimed because the current test DB does not contain a valid prepared fixture, or the source-of-truth workflow is still unclear.',
    '- `fail`: Playwright attempted the mapped live scenario and the browser assertion or interaction failed.',
    '- `not-recorded`: the manifest listed the scenario, but this run did not write a scenario result file.',
    '- `runtime-path-validation`: a harness-correction or workflow-path check that must not be read as final row proof.',
    '',
    '## Ready For Review',
    '',
    ...(summary.passes.length || summary.pendingUiReview.length
      ? [
          ...summary.passes.map(row => `- ${row.scenarioId} ${row.title}: pass`),
          ...summary.pendingUiReview.map(
            row => `- ${row.scenarioId} ${row.title}: pass-pending-ui-review`
          ),
        ]
      : ['- None in this run.']),
    '',
    '## Runtime Path Validations',
    '',
    ...(summary.runtimePathValidations.length
      ? summary.runtimePathValidations.map(
          row => `- ${row.scenarioId} ${row.title}: ${row.status} (${row.validationScope})`
        )
      : ['- None in this run.']),
    '',
    '## Failures',
    '',
    ...(summary.failures.length
      ? summary.failures.map(
          row => `- ${row.scenarioId} ${row.title}: ${row.reason || 'No reason provided'}`
        )
      : ['- None in this run.']),
    '',
    '## Top Blocked Reasons',
    '',
    ...(summary.blockedReasons.length
      ? summary.blockedReasons.slice(0, 5).map(row => `- ${row.count} scenario(s): ${row.reason}`)
      : ['- None in this run.']),
  ]

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const runDir = resolveRunDir(args.run)
  const rows = loadRows(runDir)
  const summary = buildSummary(rows)
  const runMetadataPath = path.join(runDir, 'run-metadata.json')
  const runMetadata = fs.existsSync(runMetadataPath) ? readJson(runMetadataPath) : null
  const publicRunMetadata = toPublicRunMetadata(runMetadata)
  const runId = publicRunMetadata?.runId ?? path.basename(runDir)

  const csvPath = path.join(runDir, 'reconciliation-scenarios.csv')
  const markdownPath = path.join(runDir, 'reconciliation-summary.md')
  const jsonPath = path.join(runDir, 'reconciliation-summary.json')

  writeCsv(csvPath, rows)
  writeMarkdown(markdownPath, runId, summary)
  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify({ runId, runMetadata: publicRunMetadata, summary, rows }, null, 2)}\n`,
    'utf8'
  )

  console.log(`Exported reconciliation CSV: ${csvPath}`)
  console.log(`Exported reconciliation Markdown summary: ${markdownPath}`)
  console.log(`Exported reconciliation JSON summary: ${jsonPath}`)
}

main()
