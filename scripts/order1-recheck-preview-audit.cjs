const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3001'
const AUTH_PATH = process.env.PLAYWRIGHT_AUTH_FILE || path.join(ROOT, '.artifacts', 'playwright', 'auth', 'user.json')
const MANIFEST_PATH = path.join(
  ROOT,
  'docs',
  'plans',
  '04-01-2026-Reconciliation_Master_Test_Plan',
  'generated',
  'scenario-manifest.json',
)
const DEFAULT_SCENARIO_IDS = [
  'RS-007',
  'RS-008',
  'RS-058',
  'RS-059',
  'RS-060',
  'RS-070',
  'RS-071',
  'RS-072',
  'RS-074',
  'RS-075',
  'RS-076',
  'RS-077',
]

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function getCookieHeader(authPayload) {
  const cookies = Array.isArray(authPayload?.cookies) ? authPayload.cookies : []
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
}

function classifyMatchType(lineIds, scheduleIds) {
  const lineCount = lineIds.length
  const scheduleCount = scheduleIds.length

  if (lineCount === 1 && scheduleCount === 1) return 'OneToOne'
  if (lineCount === 1 && scheduleCount > 1) return 'OneToMany'
  if (lineCount > 1 && scheduleCount === 1) return 'ManyToOne'
  if (lineCount > 1 && scheduleCount > 1) return 'ManyToMany'
  return null
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  return { response, payload }
}

function summarizeCandidateReasons(rows) {
  return rows.slice(0, 5).map(row => ({
    id: row.id,
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
  }))
}

async function auditScenario({ scenario, cookieHeader }) {
  const execution = scenario.execution || {}
  if (execution.mode !== 'browser-live') {
    return {
      scenarioId: scenario.scenarioId,
      title: scenario.title,
      executionMode: execution.mode || null,
      auditStatus: 'not-runnable',
    }
  }

  const lineIds = Array.isArray(execution.lineIds) && execution.lineIds.length > 0
    ? execution.lineIds
    : execution.lineId
      ? [execution.lineId]
      : []
  const scheduleIds = Array.isArray(execution.scheduleIds) ? execution.scheduleIds : []
  const matchType = classifyMatchType(lineIds, scheduleIds)
  const headers = {
    cookie: cookieHeader,
    'content-type': 'application/json',
  }

  const detailUrl = `${BASE_URL}/api/reconciliation/deposits/${execution.depositId}/detail`
  const detail = await fetchJson(detailUrl, { headers })

  const primaryLineId = lineIds[0] || execution.lineId || null
  const candidateUrl = primaryLineId
    ? `${BASE_URL}/api/reconciliation/deposits/${execution.depositId}/line-items/${primaryLineId}/candidates?useHierarchicalMatching=true`
    : null
  const candidate = candidateUrl ? await fetchJson(candidateUrl, { headers }) : null

  const candidateRows = Array.isArray(candidate?.payload?.data) ? candidate.payload.data : []
  const expectedScheduleIds = new Set(scheduleIds)
  const actualCandidateIds = new Set(candidateRows.map(row => row.id))
  const expectedSchedulesPresent = scheduleIds.every(id => actualCandidateIds.has(id))

  let preview = null
  if (matchType && lineIds.length > 0 && scheduleIds.length > 0 && matchType !== 'OneToOne') {
    preview = await fetchJson(
      `${BASE_URL}/api/reconciliation/deposits/${execution.depositId}/matches/preview`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          matchType,
          lineIds,
          scheduleIds,
        }),
      },
    )
  }

  const previewData = preview?.payload?.data || null
  const previewIssues = Array.isArray(previewData?.issues) ? previewData.issues : []
  const previewIssueCodes = previewIssues.map(issue => issue.code)
  const previewVariancePrompts = Array.isArray(previewData?.variancePrompts) ? previewData.variancePrompts : []
  const previewAllocations = Array.isArray(previewData?.normalizedAllocations) ? previewData.normalizedAllocations : []

  return {
    scenarioId: scenario.scenarioId,
    title: scenario.title,
    flowId: execution.flowId || null,
    executionMode: execution.mode,
    depositId: execution.depositId || null,
    lineIds,
    scheduleIds,
    derivedMatchType: matchType,
    detailStatus: detail.response.status,
    detailError: detail.payload?.error || detail.payload?.message || null,
    candidateStatus: candidate?.response.status ?? null,
    candidateError: candidate?.payload?.error || candidate?.payload?.message || null,
    candidateCount: candidateRows.length,
    expectedSchedulesPresent,
    extraCandidateCount: candidateRows.filter(row => !expectedScheduleIds.has(row.id)).length,
    candidateReasonSummary: summarizeCandidateReasons(candidateRows),
    previewStatus: preview?.response.status ?? null,
    previewError: preview?.payload?.error || preview?.payload?.message || null,
    previewOk: typeof previewData?.ok === 'boolean' ? previewData.ok : null,
    previewIssueCodes,
    previewIssueCount: previewIssueCodes.length,
    previewVariancePromptCount: previewVariancePrompts.length,
    previewAllocationCount: previewAllocations.length,
  }
}

async function main() {
  const authPayload = readJson(AUTH_PATH)
  const cookieHeader = getCookieHeader(authPayload)
  if (!cookieHeader) {
    throw new Error(`No cookies found in auth file: ${AUTH_PATH}`)
  }

  const manifest = readJson(MANIFEST_PATH)
  const requestedIds = process.argv.slice(2)
  const scenarioIds = requestedIds.length > 0 ? requestedIds : DEFAULT_SCENARIO_IDS

  const scenarios = scenarioIds.map(id => manifest.scenarios.find(row => row.scenarioId === id)).filter(Boolean)
  if (scenarios.length === 0) {
    throw new Error('No scenarios found to audit.')
  }

  const results = []
  for (const scenario of scenarios) {
    results.push(await auditScenario({ scenario, cookieHeader }))
  }

  process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL, results }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
