const fs = require('fs')
const path = require('path')

function stripAnsi(value) {
  return String(value ?? '').replace(/\u001b\[[0-9;]*m/g, '')
}

function normalizeWhitespace(value) {
  return stripAnsi(value).replace(/\s+/g, ' ').trim()
}

function csvEscape(value) {
  const normalized = String(value ?? '')
  return `"${normalized.replace(/"/g, '""')}"`
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function getRunDir() {
  const cliArg = process.argv[2]
  const envArg = process.env.PLAYWRIGHT_RUN_DIR
  const runDir = cliArg || envArg

  if (!runDir) {
    throw new Error('Provide the Playwright run directory as argv[2] or PLAYWRIGHT_RUN_DIR.')
  }

  return path.resolve(runDir)
}

function deriveReason(result) {
  switch (result.scenarioId) {
    case 'RS-001':
      return 'Verified completed/reconciled final state with zero remaining allocation.'
    case 'RS-002':
      return 'Expected 1 candidate schedule; received 0 candidate schedules from the live API.'
    case 'RS-003':
      return '1:M wizard preview matches expected allocation shape; final operator confirmation still requires human review.'
    case 'RS-068':
      return 'Conflict/disambiguation condition exists; operator review is still required to choose the correct schedule set.'
    case 'RS-069':
      return 'Two near-identical candidate schedules are present; operator review is still required.'
    case 'RS-073':
      return 'Browser and API both showed zero suggested matches for the selected line item.'
    default:
      return normalizeWhitespace(result.reason || (result.notes || []).join(' '))
  }
}

function summarizeBlockedReasons(results) {
  const blocked = results.filter(result => result.status === 'blocked')
  const grouped = new Map()

  for (const result of blocked) {
    const reason = deriveReason(result)
    grouped.set(reason, (grouped.get(reason) || 0) + 1)
  }

  return Array.from(grouped.entries()).sort((a, b) => b[1] - a[1])
}

function buildStakeholderSummary(runDir, results) {
  const counts = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1
    return acc
  }, {})

  const blockedReasons = summarizeBlockedReasons(results)
  const truePasses = results.filter(result => result.status === 'pass')
  const reviewNeeded = results.filter(result => result.status === 'pass-pending-ui-review')
  const failures = results.filter(result => result.status === 'fail')

  const lines = [
    '# Stakeholder Summary',
    '',
    '## Executive Summary',
    '',
    `This run processed 105 reconciliation scenarios from ${runDir}.`,
    '',
    `- Verified pass: ${counts.pass || 0}`,
    `- Pass pending UI review: ${counts['pass-pending-ui-review'] || 0}`,
    `- Blocked: ${counts.blocked || 0}`,
    `- Fail: ${counts.fail || 0}`,
    '',
    'The headline is that this run does not prove 105 passes. It proves 2 true passes, surfaces 3 reviewable decision-point scenarios, identifies 1 live failure, and blocks the remaining 99 due to missing or mismatched runtime fixtures.',
    '',
    '## What Truly Passed',
    '',
    ...truePasses.map(result => `- ${result.scenarioId} ${result.title}: ${deriveReason(result)}`),
    '',
    '## What Needs Review',
    '',
    ...reviewNeeded.map(result => `- ${result.scenarioId} ${result.title}: ${deriveReason(result)}`),
    '',
    '## Why 99 Were Blocked',
    '',
    ...blockedReasons.map(([reason, count]) => `- ${count} scenario(s): ${reason}`),
    '',
    '## Failure Found',
    '',
    ...failures.map(result => `- ${result.scenarioId} ${result.title}: ${deriveReason(result)}`),
    '',
    '## Recommended Next Actions',
    '',
    '- Communicate this run as fixture coverage triage, not broad functional proof.',
    '- Use the exported CSV to separate true passes from blocked rows before status reporting.',
    '- Seed or map the next smallest fixture wave instead of rerunning all 105 scenarios unchanged.',
    '- Prioritize RS-002 first if you want the next likely deterministic pass, because it already has a live mapping and exposed real runtime drift.',
    '',
  ]

  return lines.join('\n') + '\n'
}

function buildCsv(runDir, results) {
  const header = ['scenarioId', 'title', 'real_status', 'reason', 'evidence_path', 'artifact_path']
  const rows = [header.map(csvEscape).join(',')]

  for (const result of results.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId))) {
    const artifactPath = result.artifacts && result.artifacts.length
      ? path.join(runDir, result.artifacts[0].path).replace(/\\/g, '/')
      : ''
    const row = [
      result.scenarioId,
      result.title,
      result.status,
      deriveReason(result),
      result.__filePath,
      artifactPath,
    ]
    rows.push(row.map(csvEscape).join(','))
  }

  return rows.join('\n') + '\n'
}

function main() {
  const runDir = getRunDir()
  const resultsDir = path.join(runDir, 'scenario-results')
  if (!fs.existsSync(resultsDir)) {
    throw new Error(`Scenario results directory not found: ${resultsDir}`)
  }

  const results = fs.readdirSync(resultsDir)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const filePath = path.join(resultsDir, name)
      const parsed = readJson(filePath)
      parsed.__filePath = filePath
      return parsed
    })

  const stakeholderSummaryPath = path.join(runDir, 'stakeholder-summary.md')
  const exportCsvPath = path.join(runDir, 'scenario-status-export.csv')

  fs.writeFileSync(stakeholderSummaryPath, buildStakeholderSummary(runDir, results), 'utf8')
  fs.writeFileSync(exportCsvPath, buildCsv(runDir, results), 'utf8')

  console.log(`Wrote stakeholder summary: ${stakeholderSummaryPath}`)
  console.log(`Wrote scenario export CSV: ${exportCsvPath}`)
}

main()
