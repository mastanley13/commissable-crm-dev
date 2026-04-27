const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..', '..')
const artifactsRoot = path.join(rootDir, '.artifacts', 'openclaw', 'gateway-check')
const historyDir = path.join(artifactsRoot, 'history')

function timestampRunId() {
  const now = new Date()
  return now.toISOString().replace(/[:.]/g, '-')
}

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, '')
}

function resolveGatewayConfig() {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL?.trim() || ''
  const chatCompletionsUrl = process.env.OPENCLAW_CHAT_COMPLETIONS_URL?.trim() || ''
  const token = process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || process.env.OPENCLAW_GATEWAY_PASSWORD?.trim() || ''
  const model = process.env.OPENCLAW_CHAT_MODEL?.trim() || process.env.OPENCLAW_BACKEND_MODEL?.trim() || 'openclaw/default'

  let resolvedCompletionsUrl = chatCompletionsUrl
  if (!resolvedCompletionsUrl && gatewayUrl) {
    const normalized = trimTrailingSlashes(gatewayUrl)
    if (normalized.endsWith('/v1/chat/completions')) {
      resolvedCompletionsUrl = normalized
    } else if (normalized.endsWith('/v1')) {
      resolvedCompletionsUrl = `${normalized}/chat/completions`
    } else {
      resolvedCompletionsUrl = `${normalized}/v1/chat/completions`
    }
  }

  let modelsUrl = ''
  if (gatewayUrl) {
    const normalized = trimTrailingSlashes(gatewayUrl)
    modelsUrl = normalized.endsWith('/v1') ? `${normalized}/models` : `${normalized}/v1/models`
  } else if (resolvedCompletionsUrl) {
    const url = new URL(resolvedCompletionsUrl)
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (pathParts.length >= 2 && pathParts[pathParts.length - 2] === 'chat' && pathParts[pathParts.length - 1] === 'completions') {
      pathParts.splice(pathParts.length - 2, 2, 'models')
      url.pathname = `/${pathParts.join('/')}`
      modelsUrl = url.toString()
    }
  }

  return {
    gatewayUrl,
    chatCompletionsUrl,
    resolvedCompletionsUrl,
    modelsUrl,
    tokenPresent: Boolean(token),
    token,
    model,
  }
}

async function fetchJson(url, options, timeoutMs = 30000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    const text = await response.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return {
      ok: response.ok,
      status: response.status,
      text,
      json,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function buildReport(config) {
  return {
    runId: timestampRunId(),
    startedAt: new Date().toISOString(),
    environment: {
      gatewayUrlPresent: Boolean(config.gatewayUrl),
      chatCompletionsUrlPresent: Boolean(config.chatCompletionsUrl),
      resolvedCompletionsUrl: config.resolvedCompletionsUrl || null,
      modelsUrl: config.modelsUrl || null,
      tokenPresent: config.tokenPresent,
      model: config.model,
    },
    checks: [],
    status: 'pending',
  }
}

async function main() {
  const config = resolveGatewayConfig()
  const report = buildReport(config)

  fs.mkdirSync(historyDir, { recursive: true })
  const runDir = path.join(historyDir, report.runId)
  fs.mkdirSync(runDir, { recursive: true })

  const missing = []
  if (!config.resolvedCompletionsUrl) missing.push('OPENCLAW_GATEWAY_URL or OPENCLAW_CHAT_COMPLETIONS_URL')
  if (!config.tokenPresent) missing.push('OPENCLAW_GATEWAY_TOKEN')

  if (missing.length > 0) {
    report.status = 'blocked'
    report.finishedAt = new Date().toISOString()
    report.summary = `Missing required environment values: ${missing.join(', ')}`
  } else {
    const authHeader = {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    }

    if (config.modelsUrl) {
      try {
        const modelsResult = await fetchJson(config.modelsUrl, {
          method: 'GET',
          headers: authHeader,
        })
        report.checks.push({
          name: 'models',
          url: config.modelsUrl,
          ok: modelsResult.ok,
          status: modelsResult.status,
          responsePreview: modelsResult.text.slice(0, 500),
        })
      } catch (error) {
        report.checks.push({
          name: 'models',
          url: config.modelsUrl,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    try {
      const completionResult = await fetchJson(config.resolvedCompletionsUrl, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          model: config.model,
          stream: false,
          messages: [
            {
              role: 'user',
              content: 'Reply with OK and the active model.',
            },
          ],
        }),
      })

      report.checks.push({
        name: 'chat_completions',
        url: config.resolvedCompletionsUrl,
        ok: completionResult.ok,
        status: completionResult.status,
        responsePreview: completionResult.text.slice(0, 1000),
      })
    } catch (error) {
      report.checks.push({
        name: 'chat_completions',
        url: config.resolvedCompletionsUrl,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    report.status = report.checks.every((check) => check.ok) ? 'pass' : 'fail'
    report.finishedAt = new Date().toISOString()
    report.summary =
      report.status === 'pass'
        ? 'Gateway responded successfully to the required smoke checks.'
        : 'One or more gateway smoke checks failed.'
  }

  const latestPath = path.join(artifactsRoot, 'latest.json')
  const reportPath = path.join(runDir, 'gateway-check.json')
  fs.mkdirSync(artifactsRoot, { recursive: true })
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(latestPath, `${JSON.stringify({ runId: report.runId, runDir, status: report.status }, null, 2)}\n`)

  console.log(JSON.stringify(report, null, 2))
  process.exit(report.status === 'pass' ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exit(1)
})
