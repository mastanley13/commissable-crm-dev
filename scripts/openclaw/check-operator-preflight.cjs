const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..', '..')
const artifactsRoot = path.join(rootDir, '.artifacts', 'openclaw', 'operator-preflight')
const historyDir = path.join(artifactsRoot, 'history')
const DEFAULT_BASE_URL = 'https://commissable-crm-dev.vercel.app'

function timestampRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '')
}

async function readResponseBody(response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text.slice(0, 500)
  }
}

function summarizeFailure(step, details) {
  if (step === 'bot_tools_auth_contract' && details.status === 500) {
    return 'Bot tools endpoint returned 500 for an invalid token. This usually means the deployment is missing or misconfigured OPENCLAW_API_KEY or OPENCLAW_BOT_USER_ID/EMAIL.'
  }
  if (step === 'bot_tools_auth_contract' && details.status === 200) {
    return 'Bot tools endpoint accepted an intentionally invalid token. Check bot API authentication before client testing.'
  }
  return details.error || `Unexpected status ${details.status}.`
}

async function checkBotToolsAuthContract(baseUrl) {
  const url = `${baseUrl}/api/bot/v1/tools/manifest`
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: 'Bearer intentionally-invalid-openclaw-preflight-key',
      },
      cache: 'no-store',
    })
    const body = await readResponseBody(response)
    const passed = response.status === 401

    return {
      step: 'bot_tools_auth_contract',
      passed,
      severity: passed ? '' : 'Blocker',
      url,
      status: response.status,
      expectedStatus: 401,
      bodySummary: typeof body === 'string' ? body : body ? JSON.stringify(body).slice(0, 500) : null,
      notes: passed
        ? 'Bot tools endpoint rejects invalid tokens as expected.'
        : summarizeFailure('bot_tools_auth_contract', { status: response.status }),
    }
  } catch (error) {
    return {
      step: 'bot_tools_auth_contract',
      passed: false,
      severity: 'Blocker',
      url,
      status: null,
      expectedStatus: 401,
      bodySummary: null,
      notes: summarizeFailure('bot_tools_auth_contract', {
        error: error instanceof Error ? error.message : String(error),
      }),
    }
  }
}

async function checkAuthenticatedStatus(baseUrl) {
  const cookie = process.env.OPENCLAW_PREFLIGHT_COOKIE?.trim()
  const url = `${baseUrl}/api/openclaw/status`

  if (!cookie) {
    return {
      step: 'browser_status_contract',
      passed: true,
      skipped: true,
      severity: '',
      url,
      status: null,
      expectedStatus: 200,
      notes: 'Skipped authenticated status check because OPENCLAW_PREFLIGHT_COOKIE is not set.',
    }
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { cookie },
      cache: 'no-store',
    })
    const body = await readResponseBody(response)
    const data = body && typeof body === 'object' ? body.data : null
    const passed =
      response.status === 200 &&
      data &&
      data.responseModes &&
      data.responseModes.crmReadOnlyFallback === true

    return {
      step: 'browser_status_contract',
      passed,
      skipped: false,
      severity: passed ? '' : 'Major',
      url,
      status: response.status,
      expectedStatus: 200,
      bodySummary: typeof body === 'string' ? body : body ? JSON.stringify(body).slice(0, 500) : null,
      notes: passed
        ? 'Authenticated browser status endpoint reports CRM read-only fallback support.'
        : 'Authenticated status endpoint did not return the expected CRM read-only readiness contract.',
    }
  } catch (error) {
    return {
      step: 'browser_status_contract',
      passed: false,
      skipped: false,
      severity: 'Major',
      url,
      status: null,
      expectedStatus: 200,
      bodySummary: null,
      notes: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.OPENCLAW_PREFLIGHT_BASE_URL?.trim() || DEFAULT_BASE_URL)
  const runId = timestampRunId()
  const runDir = path.join(historyDir, runId)
  fs.mkdirSync(runDir, { recursive: true })

  const checks = [
    await checkBotToolsAuthContract(baseUrl),
    await checkAuthenticatedStatus(baseUrl),
  ]

  const report = {
    runId,
    baseUrl,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    status: checks.every((check) => check.passed) ? 'pass' : 'fail',
    checks,
  }

  fs.mkdirSync(artifactsRoot, { recursive: true })
  fs.writeFileSync(path.join(runDir, 'operator-preflight.json'), `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(
    path.join(artifactsRoot, 'latest.json'),
    `${JSON.stringify({ runId, runDir, status: report.status, baseUrl }, null, 2)}\n`,
  )

  console.log(JSON.stringify({ runId, runDir, status: report.status, baseUrl, checks }, null, 2))
  process.exit(report.status === 'pass' ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exit(1)
})
