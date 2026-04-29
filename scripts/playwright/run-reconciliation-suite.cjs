const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const {
  artifactsRoot,
  rootDir,
  suiteHistoryDir,
  suiteLatestPath,
  suiteLatestPartialPath,
} = require('./reconciliation-suite-paths.cjs')

const authDir = path.join(artifactsRoot, 'auth')
const playwrightCliPath = require.resolve('@playwright/test/cli')
const scenarioManifestPath = path.join(
  rootDir,
  'docs',
  'plans',
  '04-01-2026-Reconciliation_Master_Test_Plan',
  'generated',
  'scenario-manifest.json'
)

function parseEnvValue(rawValue) {
  const trimmed = String(rawValue ?? '').trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) {
      continue
    }

    const [, key, rawValue] = match
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = parseEnvValue(rawValue)
    }
  }
}

function loadPlaywrightEnv() {
  loadEnvFile(path.join(rootDir, '.env'))
  loadEnvFile(path.join(rootDir, '.env.local'))
}

function timestampRunId() {
  const now = new Date()
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ]
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ]

  return `${parts.join('-')}_${time.join('-')}`
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function runNodeScript(scriptPath, env) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: rootDir,
    stdio: 'inherit',
    env,
  })

  return typeof result.status === 'number' ? result.status : 1
}

function getGitCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: rootDir,
    encoding: 'utf8',
  })

  return result.status === 0 ? result.stdout.trim() : null
}

function shouldSkipPostProcessing(args) {
  return args.includes('--list') || args.includes('--help')
}

function isFullSuiteRun(args) {
  const selectionFlags = new Set([
    '--grep',
    '--grep-invert',
    '--last-failed',
    '--project',
    '--shard',
    '--test-list',
    '--test-list-invert',
  ])

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index]
    if (selectionFlags.has(current)) {
      return false
    }
  }

  return true
}

function buildRunMetadata({
  runId,
  runDir,
  authFile,
  startedAt,
  finishedAt,
  exitCode,
  statusCounts,
  isFullSuite,
}) {
  const manifest = fs.existsSync(scenarioManifestPath) ? readJson(scenarioManifestPath) : null

  return {
    runId,
    runDir,
    suiteName: 'reconciliation-suite',
    startedAt,
    finishedAt,
    exitCode,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    authFile,
    environmentLabel: process.env.PLAYWRIGHT_ENV_LABEL ?? 'local',
    fixtureVersion: process.env.PLAYWRIGHT_FIXTURE_VERSION ?? 'unspecified',
    scenarioManifestPath: path.relative(rootDir, scenarioManifestPath).replace(/\\/g, '/'),
    scenarioManifestGeneratedAt: manifest?.generatedAt ?? null,
    scenarioCount: Array.isArray(manifest?.scenarios) ? manifest.scenarios.length : null,
    isFullSuiteRun: isFullSuite,
    gitCommit: getGitCommit(),
    statusCounts: statusCounts ?? null,
    artifactPaths: {
      htmlDir: path.join(runDir, 'html'),
      resultsJson: path.join(runDir, 'results.json'),
      resultsXml: path.join(runDir, 'results.xml'),
      testResultsDir: path.join(runDir, 'test-results'),
      scenarioResultsDir: path.join(runDir, 'scenario-results'),
      reconciliationSummaryJson: path.join(runDir, 'reconciliation-summary.json'),
      reconciliationSummaryMarkdown: path.join(runDir, 'reconciliation-summary.md'),
      reconciliationScenariosCsv: path.join(runDir, 'reconciliation-scenarios.csv'),
    },
  }
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function syncSummaryRunMetadata(runDir, runMetadata) {
  const summaryPath = path.join(runDir, 'reconciliation-summary.json')
  if (!fs.existsSync(summaryPath)) {
    return
  }

  const summaryPayload = readJson(summaryPath)
  writeJson(summaryPath, {
    ...summaryPayload,
    runMetadata: toPublicRunMetadata(runMetadata),
  })
}

function main() {
  loadPlaywrightEnv()

  const cliArgs = process.argv.slice(2)
  const runId = process.env.PLAYWRIGHT_RUN_ID ?? timestampRunId()
  const runDir = path.join(suiteHistoryDir, runId)
  const authFile = process.env.PLAYWRIGHT_AUTH_FILE ?? path.join(authDir, 'user.json')
  const startedAt = new Date().toISOString()
  const fullSuiteRun = isFullSuiteRun(cliArgs)

  fs.mkdirSync(runDir, { recursive: true })
  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  const initialMetadata = buildRunMetadata({
    runId,
    runDir,
    authFile,
    startedAt,
    finishedAt: null,
    exitCode: null,
    statusCounts: null,
    isFullSuite: fullSuiteRun,
  })
  writeJson(path.join(runDir, 'run-metadata.json'), initialMetadata)

  const playwrightResult = spawnSync(
    process.execPath,
    [playwrightCliPath, 'test', 'tests/e2e/reconciliation-suite.spec.ts', ...cliArgs],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_RUN_ID: runId,
        PLAYWRIGHT_RUN_DIR: runDir,
        PLAYWRIGHT_AUTH_FILE: authFile,
        PLAYWRIGHT_SUITE_NAME: 'reconciliation-suite',
      },
    }
  )

  const finishedAt = new Date().toISOString()
  let exitCode = typeof playwrightResult.status === 'number' ? playwrightResult.status : 1
  let statusCounts = null
  const skipPostProcessing = shouldSkipPostProcessing(cliArgs)
  const hasScenarioResults = fs.existsSync(path.join(runDir, 'scenario-results'))

  if (!skipPostProcessing && hasScenarioResults) {
    const exportStatus = runNodeScript(path.join(__dirname, 'export-reconciliation-results.cjs'), {
      ...process.env,
      PLAYWRIGHT_RUN_DIR: runDir,
    })
    if (exportStatus !== 0) {
      exitCode = exitCode === 0 ? exportStatus : exitCode
    }

    const summaryPath = path.join(runDir, 'reconciliation-summary.json')
    if (fs.existsSync(summaryPath)) {
      const summaryPayload = readJson(summaryPath)
      statusCounts = summaryPayload.summary?.statusCounts ?? null
    }
  }

  const finalMetadata = buildRunMetadata({
    runId,
    runDir,
    authFile,
    startedAt,
    finishedAt,
    exitCode,
    statusCounts,
    isFullSuite: fullSuiteRun,
  })

  writeJson(path.join(runDir, 'run-metadata.json'), finalMetadata)
  syncSummaryRunMetadata(runDir, finalMetadata)
  if (!skipPostProcessing && hasScenarioResults) {
    const latestPayload = {
      runId,
      runDir,
      suiteName: 'reconciliation-suite',
      generatedAt: finishedAt,
      scenarioCount: finalMetadata.scenarioCount,
      isFullSuiteRun: fullSuiteRun,
      statusCounts: statusCounts ?? {},
      reconciliationSummaryJson: path.join(runDir, 'reconciliation-summary.json'),
    }

    writeJson(fullSuiteRun ? suiteLatestPath : suiteLatestPartialPath, latestPayload)
  }

  process.exit(exitCode)
}

main()
