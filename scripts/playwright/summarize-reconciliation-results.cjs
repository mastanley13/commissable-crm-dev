const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..', '..')
const manifestPath = path.join(
  rootDir,
  'docs',
  'plans',
  '04-01-2026-Reconciliation_Master_Test_Plan',
  'generated',
  'scenario-manifest.json'
)

const projectRunDir = process.env.PLAYWRIGHT_RUN_DIR
if (!projectRunDir) {
  throw new Error('PLAYWRIGHT_RUN_DIR is required to summarize reconciliation results.')
}

function resolveResultsDir(runDir) {
  const directResultsDir = path.join(runDir, 'scenario-results')
  if (fs.existsSync(directResultsDir)) {
    return directResultsDir
  }

  const historySiblingResultsDir = path.join(
    rootDir,
    '.artifacts',
    'playwright',
    'history',
    path.basename(runDir),
    'scenario-results'
  )
  if (fs.existsSync(historySiblingResultsDir)) {
    return historySiblingResultsDir
  }

  return directResultsDir
}

const resultsDir = resolveResultsDir(projectRunDir)
const summaryPath = path.join(projectRunDir, 'final-summary.md')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function normalizeReason(reason) {
  if (!reason) return 'unspecified'
  if (reason.includes('Current TEST DB inventory captured on 2026-04-03')) {
    return 'No aligned prepared deposit fixture in current TEST DB'
  }
  if (reason.includes('1:M') && reason.includes('many-lines-to-one-schedule')) {
    return 'Scope conflict between current 1:M behavior and older M:1 wording'
  }
  return reason
}

function buildSummary() {
  const manifest = readJson(manifestPath)
  const resultFiles = fs.existsSync(resultsDir)
    ? fs.readdirSync(resultsDir).filter(name => name.endsWith('.json'))
    : []
  const resultsByScenarioId = new Map(
    resultFiles.map(fileName => {
      const fullPath = path.join(resultsDir, fileName)
      const parsed = readJson(fullPath)
      return [parsed.scenarioId, parsed]
    })
  )

  const scenarios = manifest.scenarios.map(scenario => {
    const validationScope =
      scenario.execution.mode === 'browser-live'
        ? (resultsByScenarioId.get(scenario.scenarioId)?.execution?.validationScope ??
          scenario.execution.validationScope ??
          'scenario-proof')
        : 'scenario-proof'

    return {
      scenario,
      validationScope,
      result:
        resultsByScenarioId.get(scenario.scenarioId) ?? {
          scenarioId: scenario.scenarioId,
          status: 'fail',
          reason: 'Missing scenario result artifact',
          notes: [],
        },
    }
  })

  const laneCounts = scenarios.reduce((acc, row) => {
    acc[row.scenario.lane] = (acc[row.scenario.lane] ?? 0) + 1
    return acc
  }, {})

  const statusCounts = scenarios.reduce((acc, row) => {
    acc[row.result.status] = (acc[row.result.status] ?? 0) + 1
    return acc
  }, {})

  const knownBugList = [
    'Note-level risk from 2026-03-16/2026-03-18 validation: mixed-rate bundle provenance/test instability remains documented and was not directly re-executed in this browser pass.',
    'Note-level risk from 2026-03-16 validation: rate-discrepancy audit payload drift remains documented and was not directly re-executed in this browser pass.',
    'Note-level risk from 2026-03-16 validation: within-tolerance response-contract drift remains documented and was not directly re-executed in this browser pass.',
  ]

  const needsClarification = scenarios
    .filter(row => row.scenario.lane === 'needs-clarification' || normalizeReason(row.result.reason).includes('Scope conflict'))
    .map(row => `- ${row.scenario.scenarioId} ${row.scenario.title}: ${row.result.reason ?? 'Clarification required.'}`)

  const recurringFailurePatterns = Array.from(
    scenarios.reduce((acc, row) => {
      const status = row.result.status
      if (status !== 'blocked' && status !== 'fail') return acc
      const key = normalizeReason(row.result.reason)
      acc.set(key, (acc.get(key) ?? 0) + 1)
      return acc
    }, new Map()).entries()
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const clientReviewReady = scenarios
    .filter(
      row =>
        (row.result.status === 'pass' || row.result.status === 'pass-pending-ui-review') &&
        row.validationScope !== 'runtime-path-validation'
    )
    .map(row => `- ${row.scenario.scenarioId} ${row.scenario.title}: ${row.result.status}`)

  const runtimePathValidations = scenarios
    .filter(
      row =>
        row.validationScope === 'runtime-path-validation' &&
        (row.result.status === 'pass' || row.result.status === 'pass-pending-ui-review')
    )
    .map(
      row =>
        `- ${row.scenario.scenarioId} ${row.scenario.title}: ${row.result.status} (${row.validationScope})`
    )

  const lines = [
    '# Reconciliation Playwright QA Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Totals',
    '',
    `- Total scenarios processed: ${scenarios.length}`,
    `- Pass: ${statusCounts.pass ?? 0}`,
    `- Fail: ${statusCounts.fail ?? 0}`,
    `- Blocked: ${statusCounts.blocked ?? 0}`,
    `- Pass-pending-ui-review: ${statusCounts['pass-pending-ui-review'] ?? 0}`,
    '',
    '## Counts By Lane',
    '',
    `- @deterministic: ${laneCounts['deterministic'] ?? 0}`,
    `- @ui-review: ${laneCounts['ui-review'] ?? 0}`,
    `- @known-bug: ${laneCounts['known-bug'] ?? 0}`,
    `- @needs-clarification: ${laneCounts['needs-clarification'] ?? 0}`,
    '',
    '## Known Bug List',
    '',
    ...knownBugList.map(item => `- ${item}`),
    '',
    '## Needs Clarification List',
    '',
    ...(needsClarification.length ? needsClarification : ['- None added in this run.']),
    '',
    '## Top Recurring Failure Patterns',
    '',
    ...(recurringFailurePatterns.length
      ? recurringFailurePatterns.map(([reason, count]) => `- ${count} scenario(s): ${reason}`)
      : ['- No blocked or failed scenarios were recorded.']),
    '',
    '## Scenarios Most Likely Ready For Client Review Now',
    '',
    ...(clientReviewReady.length ? clientReviewReady : ['- None yet.']),
    '',
    '## Harness Corrections / Runtime-path Validations',
    '',
    ...(runtimePathValidations.length ? runtimePathValidations : ['- None in this run.']),
    '',
  ]

  fs.mkdirSync(projectRunDir, { recursive: true })
  fs.writeFileSync(summaryPath, lines.join('\n') + '\n', 'utf8')
  console.log(`Wrote reconciliation summary: ${summaryPath}`)
}

buildSummary()
