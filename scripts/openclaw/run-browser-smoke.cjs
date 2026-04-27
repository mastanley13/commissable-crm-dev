const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const rootDir = path.resolve(__dirname, '..', '..')
const artifactsRoot = path.join(rootDir, '.artifacts', 'openclaw', 'browser-smoke')
const historyDir = path.join(artifactsRoot, 'history')
const corpusPath = path.join(
  rootDir,
  'docs',
  'plans',
  '2026-04-20-import-openclaw-completion-sprint',
  '2026-04-23_openclaw-eval-prompt-corpus.csv',
)

const LIVE_SMOKE_PROMPT_IDS = [
  'OC-EVAL-001',
  'OC-EVAL-003',
  'OC-EVAL-011',
  'OC-EVAL-013',
  'OC-EVAL-017',
  'OC-EVAL-021',
]

const DEGRADED_SMOKE_PROMPT_IDS = ['OC-EVAL-033']

function timestampRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const [header = [], ...data] = rows
  return data.map((entry) =>
    Object.fromEntries(header.map((name, index) => [name, entry[index] ?? ''])),
  )
}

function loadPrompts(mode) {
  const text = fs.readFileSync(corpusPath, 'utf8')
  const corpus = parseCsv(text)
  const ids = mode === 'degraded' ? DEGRADED_SMOKE_PROMPT_IDS : LIVE_SMOKE_PROMPT_IDS
  return ids.map((id) => {
    const row = corpus.find((entry) => entry.prompt_id === id)
    if (!row) {
      throw new Error(`Prompt id not found in corpus: ${id}`)
    }
    return row
  })
}

async function waitForAssistantReply(page, previousCount, timeoutMs = 90000) {
  const selector = '.whitespace-pre-wrap.break-words'
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const count = await page.locator(selector).count()
    const thinkingVisible = await page.getByText('Thinking').isVisible().catch(() => false)
    if (count >= previousCount + 2 && !thinkingVisible) {
      return true
    }
    await page.waitForTimeout(500)
  }

  return false
}

async function loginOrRegister(page, baseUrl) {
  const forcedEmail = process.env.OPENCLAW_SMOKE_EMAIL?.trim()
  const forcedPassword = process.env.OPENCLAW_SMOKE_PASSWORD?.trim()
  const password = forcedPassword || 'password123'
  const email = forcedEmail || `openclaw-smoke-${Date.now()}@example.com`

  if (!forcedEmail) {
    await page.goto(`${baseUrl}/register`)
    await page.getByLabel(/first name/i).fill('OpenClaw')
    await page.getByLabel(/last name/i).fill('Smoke')
    await page.getByLabel(/email address/i).fill(email)
    await page.getByLabel(/^password/i).fill(password)
    await page.getByLabel(/confirm password/i).fill(password)
    await page.getByLabel(/job title/i).fill('QA')
    await page.getByLabel(/department/i).fill('Testing')
    await page.getByRole('button', { name: /create account/i }).click()
    await page.waitForLoadState('networkidle')
  }

  await page.goto(`${baseUrl}/login`)
  await page.getByPlaceholder('Email address').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/accounts(?:\/)?$/, { timeout: 30000 })

  return { email, passwordSource: forcedPassword ? 'provided' : 'generated' }
}

function classifyTransport(result) {
  if (result.offlineFallbackVisible || result.noLiveAnswerVisible) {
    return 'offline_fallback'
  }
  if (result.lastAssistantMessage) {
    return 'live_response'
  }
  return 'no_response'
}

function evaluatePrompt(mode, prompt, result) {
  const transportClass = classifyTransport(result)

  if (mode === 'live') {
    const passed = transportClass === 'live_response'
    return {
      transportClass,
      result: passed ? 'Pass' : 'Fail',
      severity: passed ? '' : 'Blocker',
      notes: passed
        ? 'Live answer path is available. Manual answer-quality review still required.'
        : 'Live answer path failed. Browser stayed in degraded/offline behavior.',
    }
  }

  const passed = transportClass === 'offline_fallback'
  return {
    transportClass,
    result: passed ? 'Pass' : 'Fail',
    severity: passed ? '' : 'Major',
    notes: passed
      ? 'Degraded-mode browser behavior triggered as expected.'
      : 'Expected degraded-mode browser behavior, but a clear offline fallback was not detected.',
  }
}

function toCsv(rows) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (value) => {
    const stringValue = value == null ? '' : String(value)
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }
    return stringValue
  }
  return `${headers.join(',')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(',')).join('\n')}\n`
}

function toMarkdown(report) {
  const lines = [
    `# OpenClaw Browser Smoke Run ${report.runId}`,
    '',
    `Mode: \`${report.mode}\``,
    `Date: ${report.finishedAt.slice(0, 10)}`,
    `Base URL: \`${report.baseUrl}\``,
    `Prompt count: ${report.results.length}`,
    `Passed: ${report.results.filter((row) => row.result === 'Pass').length}`,
    `Failed: ${report.results.filter((row) => row.result === 'Fail').length}`,
    '',
    '## Results',
    '',
    '| Prompt ID | Expected | Transport | Result | Notes |',
    '| --- | --- | --- | --- | --- |',
    ...report.results.map((row) => `| \`${row.prompt_id}\` | \`${row.expected_answer_class}\` | \`${row.transport_class}\` | ${row.result} | ${row.notes} |`),
    '',
  ]

  return `${lines.join('\n')}\n`
}

async function main() {
  const mode = (process.env.OPENCLAW_SMOKE_MODE?.trim() || 'live').toLowerCase()
  if (!['live', 'degraded'].includes(mode)) {
    throw new Error(`Unsupported OPENCLAW_SMOKE_MODE: ${mode}`)
  }

  const baseUrl = process.env.OPENCLAW_SMOKE_BASE_URL?.trim() || process.env.PLAYWRIGHT_BASE_URL?.trim() || 'http://127.0.0.1:3000'
  const prompts = loadPrompts(mode)
  const runId = timestampRunId()
  const runDir = path.join(historyDir, runId)
  fs.mkdirSync(runDir, { recursive: true })

  const report = {
    runId,
    mode,
    baseUrl,
    startedAt: new Date().toISOString(),
    results: [],
    status: 'pending',
  }

  const browser = await chromium.launch({ headless: process.env.OPENCLAW_SMOKE_HEADED !== 'true' })
  try {
    const page = await browser.newPage()
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
    const authInfo = await loginOrRegister(page, baseUrl)
    report.auth = authInfo

    await page.goto(`${baseUrl}/bot`)
    await page.getByRole('heading', { name: /commissable bot/i }).waitFor({ timeout: 30000 })

    for (const prompt of prompts) {
      await page.getByRole('button', { name: /clear chat/i }).click()
      await page.waitForTimeout(400)

      const beforeCount = await page.locator('.whitespace-pre-wrap.break-words').count()
      const input = page.getByPlaceholder('Message Commissable Bot')
      await input.fill(prompt.prompt_text)
      await input.press('Enter')
      await waitForAssistantReply(page, beforeCount)

      const allMessages = await page.locator('.whitespace-pre-wrap.break-words').allTextContents()
      const lastAssistantMessage = allMessages[allMessages.length - 1] || ''
      const offlineFallbackVisible = (await page.getByText('Offline Fallback').count()) > 0
      const noLiveAnswerVisible = (await page.getByText('No live CRM answer returned').count()) > 0
      const bannerText = (await page.locator('.mb-3').allTextContents()).join(' | ')

      const evaluation = evaluatePrompt(mode, prompt, {
        lastAssistantMessage,
        offlineFallbackVisible,
        noLiveAnswerVisible,
      })

      report.results.push({
        prompt_id: prompt.prompt_id,
        prompt_text: prompt.prompt_text,
        expected_answer_class: prompt.expected_answer_class,
        transport_class: evaluation.transportClass,
        result: evaluation.result,
        severity: evaluation.severity,
        offline_fallback_visible: offlineFallbackVisible,
        no_live_answer_visible: noLiveAnswerVisible,
        banner_text: bannerText,
        last_assistant_message: lastAssistantMessage,
        notes: evaluation.notes,
      })
    }
  } finally {
    await browser.close()
  }

  report.finishedAt = new Date().toISOString()
  report.status = report.results.every((row) => row.result === 'Pass') ? 'pass' : 'fail'

  fs.mkdirSync(artifactsRoot, { recursive: true })
  fs.writeFileSync(path.join(runDir, 'browser-smoke.json'), `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(path.join(runDir, 'browser-smoke.csv'), toCsv(report.results))
  fs.writeFileSync(path.join(runDir, 'browser-smoke.md'), toMarkdown(report))
  fs.writeFileSync(path.join(artifactsRoot, 'latest.json'), `${JSON.stringify({ runId, runDir, status: report.status, mode }, null, 2)}\n`)

  console.log(JSON.stringify({ runId, runDir, status: report.status, mode }, null, 2))
  process.exit(report.status === 'pass' ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exit(1)
})
