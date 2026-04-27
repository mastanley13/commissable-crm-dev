const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')

const rootDir = path.resolve(__dirname, '..', '..')
const sourceCsvPath = path.join(
  rootDir,
  'docs',
  'plans',
  '04-01-2026-Reconciliation_Master_Test_Plan',
  'Commissable_Master_Test_Plan.xlsx - Reconciliation Scenarios (1).csv'
)
const outputDir = path.join(
  rootDir,
  'docs',
  'plans',
  '04-01-2026-Reconciliation_Master_Test_Plan',
  'generated'
)
const outputCsvPath = path.join(outputDir, '2026-04-03_playwright_scenario_crosswalk.csv')
const outputMdPath = path.join(outputDir, '2026-04-03_playwright_scenario_crosswalk.md')

const FLOW_MAP = {
  'PW-01': {
    spec: 'tests/e2e/reconciliation.1to1.spec.ts',
    tc: 'TC-01, TC-02, TC-03',
    label: '1:1 exact, metadata-assisted, and candidate ranking',
  },
  'PW-02': {
    spec: 'tests/e2e/reconciliation.1toM.spec.ts',
    tc: 'TC-05, TC-17',
    label: '1:M split allocation, over-allocation, and manual distribution',
  },
  'PW-03': {
    spec: 'tests/e2e/reconciliation.Mto1.spec.ts',
    tc: 'TC-04',
    label: 'M:1 rollup allocation, aggregate variance, and under-allocation review',
  },
  'PW-04': {
    spec: 'tests/e2e/reconciliation.variance-rate.spec.ts',
    tc: 'TC-06, TC-08, TC-17',
    label: 'variance, tolerance, rate discrepancy, and operator decisions',
  },
  'PW-05': {
    spec: 'tests/e2e/reconciliation.bundle.spec.ts',
    tc: 'TC-05, TC-06, TC-12',
    label: 'bundle, rip-and-replace, and mixed-rate bundle flows',
  },
  'PW-06': {
    spec: 'tests/e2e/reconciliation.adjustments-undo.spec.ts',
    tc: 'TC-14, TC-15',
    label: 'chargebacks, negative adjustments, and undo/unmatch safety',
  },
  'PW-08': {
    spec: 'tests/e2e/reconciliation.unmatched-partial.spec.ts',
    tc: 'TC-09, TC-17',
    label: 'unmatched, rejected, and partial-match operator paths',
  },
}

function contains(text, pattern) {
  return text.toLowerCase().includes(pattern.toLowerCase())
}

function coverageFor(group) {
  if (group === 'System Edge Cases') return 'Automation-first, Playwright spot-check'
  if (['Financial Variance', 'Rate Variance', 'Combined Variance', 'Carrier Issues'].includes(group)) {
    return 'Playwright + engine assertion'
  }

  return 'Primary Playwright'
}

function determineFlow(row) {
  const group = row.Group
  const matchType = row['Match Type']
  const scenarioName = row['Scenario Name']
  const expectedStatus = row['Expected Status'] ?? ''

  if (contains(scenarioName, 'Bundle') || contains(scenarioName, 'Rip & Replace')) return 'PW-05'
  if (contains(scenarioName, 'chargeback') || contains(scenarioName, 'clawback') || contains(scenarioName, 'undo')) return 'PW-06'
  if (group === 'Carrier Issues' && (contains(scenarioName, 'Netted Credit') || contains(scenarioName, 'Flat Commission'))) return 'PW-06'
  if (matchType === '1:M') return 'PW-02'
  if (matchType === 'M:1') return 'PW-03'
  if (matchType === 'Partial' || matchType === 'None') return 'PW-08'
  if (group === 'Data Quality') return 'PW-01'
  if (group === 'Matching Conflict') {
    if (matchType === '1:1') return 'PW-01'
    return 'PW-08'
  }
  if (group === 'Decision Paths') {
    if (contains(expectedStatus, 'Partial') || contains(expectedStatus, 'Rejected')) return 'PW-08'
    if (contains(scenarioName, 'rate') || contains(scenarioName, 'Usage Variance') || contains(scenarioName, 'payout')) return 'PW-04'
    return 'PW-01'
  }
  if (['Financial Variance', 'Rate Variance', 'Combined Variance', 'Carrier Issues', 'System Edge Cases'].includes(group)) {
    return 'PW-04'
  }

  return 'PW-01'
}

function sortKeyForFlow(flowId) {
  const order = ['PW-01', 'PW-02', 'PW-03', 'PW-04', 'PW-05', 'PW-06', 'PW-08']
  const index = order.indexOf(flowId)
  return index === -1 ? 999 : index + 1
}

function notesFor(row, flowId) {
  const group = row.Group

  if (flowId === 'PW-04' && group === 'System Edge Cases') {
    return 'Prefer automation for penny math and rounding; keep one browser proof per visible modal branch.'
  }

  if (flowId === 'PW-04') {
    return 'Requires deterministic seeded data and assertion of visible variance/rate decision UI.'
  }

  if (flowId === 'PW-08') {
    return 'Use operator-facing unmatched or partial data fixtures; avoid asserting hidden ledger math here.'
  }

  if (flowId === 'PW-06') {
    return 'Capture audit/history and post-action state after adjustment or undo.'
  }

  return 'Use deterministic deposit batch and schedule fixtures so the visible candidate set stays stable.'
}

function summarizeCounts(rows, key) {
  const counts = new Map()
  for (const row of rows) {
    counts.set(row[key], (counts.get(row[key]) ?? 0) + 1)
  }
  return Array.from(counts.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
}

function main() {
  const csv = fs.readFileSync(sourceCsvPath, 'utf8')
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })
  const sourceRows = parsed.data

  const crosswalkRows = sourceRows.map(row => {
    const flowId = determineFlow(row)
    const flow = FLOW_MAP[flowId]
    return {
      scenario_id: `RS-${row['#']}`,
      row_number: row['#'],
      group: row.Group,
      match_type: row['Match Type'],
      scenario_name: row['Scenario Name'],
      expected_status: row['Expected Status'],
      coverage_mode: coverageFor(row.Group),
      playwright_flow_id: flowId,
      playwright_flow_label: flow.label,
      suggested_spec: flow.spec,
      primary_manual_tc: flow.tc,
      flow_execution_order: sortKeyForFlow(flowId),
      notes: notesFor(row, flowId),
    }
  })

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputCsvPath, Papa.unparse(crosswalkRows), 'utf8')

  const coverageCounts = summarizeCounts(crosswalkRows, 'coverage_mode')
  const flowCounts = summarizeCounts(crosswalkRows, 'playwright_flow_id')

  const md = [
    '# Playwright Scenario Crosswalk',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Source: \`docs/plans/04-01-2026-Reconciliation_Master_Test_Plan/Commissable_Master_Test_Plan.xlsx - Reconciliation Scenarios (1).csv\``,
    '',
    '## Coverage Modes',
    '',
    '| Coverage Mode | Scenario Count |',
    '| --- | ---: |',
    ...coverageCounts.map(([name, count]) => `| ${name} | ${count} |`),
    '',
    '## Playwright Flow Buckets',
    '',
    '| Flow ID | Target Spec | Scenario Count | Manual TC Anchor |',
    '| --- | --- | ---: | --- |',
    ...flowCounts.map(([flowId, count]) => {
      const flow = FLOW_MAP[flowId]
      return `| ${flowId} | \`${flow.spec}\` | ${count} | ${flow.tc} |`
    }),
    '',
    '## Output Files',
    '',
    `- CSV: \`${path.relative(rootDir, outputCsvPath).replace(/\\/g, '/')}\``,
    `- This summary: \`${path.relative(rootDir, outputMdPath).replace(/\\/g, '/')}\``,
    '',
    '## Operating Rule',
    '',
    'The crosswalk maps each scenario row to the smallest Playwright flow that can prove the visible operator branch. Variance math, penny handling, and ledger-heavy rows should still be backed by integration tests before broad browser execution.',
    '',
  ].join('\n')

  fs.writeFileSync(outputMdPath, md, 'utf8')

  console.log(`Generated crosswalk CSV: ${outputCsvPath}`)
  console.log(`Generated crosswalk summary: ${outputMdPath}`)
}

main()
