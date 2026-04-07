import fs from 'fs'
import path from 'path'
import type { Page, TestInfo } from '@playwright/test'

export type ScenarioLane = 'deterministic' | 'ui-review' | 'known-bug' | 'needs-clarification'
export type ScenarioStatus = 'pass' | 'fail' | 'blocked' | 'pass-pending-ui-review'
export type ScenarioValidationScope = 'scenario-proof' | 'runtime-path-validation'

export type ScenarioExecution =
  | {
      mode: 'browser-live'
      flowId: string
      depositId: string
      lineId: string
      lineIds?: string[]
      scheduleIds: string[]
      validationScope?: ScenarioValidationScope
      resultNotes?: string[]
    }
  | {
      mode: 'blocked-no-runtime-fixture'
      reason: string
    }

export interface ScenarioManifestEntry {
  scenarioId: string
  group: string
  title: string
  lane: ScenarioLane
  shortGoal: string
  preconditions: string[]
  browserSteps: string[]
  deterministicAssertions: string[]
  uiAssertions: string[]
  artifactsRequired: string[]
  notes: string[]
  execution: ScenarioExecution
}

export interface ScenarioManifest {
  generatedAt: string
  sourceCsv: string
  notes: string[]
  laneCounts: Record<string, number>
  liveScenarioIds: string[]
  scenarios: ScenarioManifestEntry[]
}

export interface ScenarioArtifactRef {
  label: string
  path: string
}

export interface ScenarioResult {
  scenarioId: string
  title: string
  lane: ScenarioLane
  status: ScenarioStatus
  startedAt: string
  finishedAt: string
  reason?: string
  notes: string[]
  artifacts: ScenarioArtifactRef[]
  execution: ScenarioExecution
}

const manifestPath = path.resolve(
  process.cwd(),
  'docs',
  'plans',
  '04-01-2026-Reconciliation_Master_Test_Plan',
  'generated',
  'scenario-manifest.json'
)

export function loadScenarioManifest(): ScenarioManifest {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ScenarioManifest
}

export function getRunRoot(testInfo: TestInfo): string {
  if (process.env.PLAYWRIGHT_RUN_DIR) {
    return path.resolve(process.env.PLAYWRIGHT_RUN_DIR)
  }

  return path.resolve(testInfo.outputDir, '..', '..')
}

export async function captureScenarioScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string
): Promise<ScenarioArtifactRef> {
  const fileName = `${name}.png`
  const screenshotPath = testInfo.outputPath(fileName)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  return {
    label: name,
    path: path.relative(getRunRoot(testInfo), screenshotPath).replace(/\\/g, '/'),
  }
}

export async function writeScenarioResult(testInfo: TestInfo, result: ScenarioResult): Promise<string> {
  const resultsDir = path.join(getRunRoot(testInfo), 'scenario-results')
  fs.mkdirSync(resultsDir, { recursive: true })
  const filePath = path.join(resultsDir, `${result.scenarioId}.json`)
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2) + '\n', 'utf8')
  await testInfo.attach(`${result.scenarioId}-result`, {
    path: filePath,
    contentType: 'application/json',
  })
  return filePath
}

export async function fetchJson<T = unknown>(
  page: Page,
  endpoint: string
): Promise<{ ok: boolean; status: number; data: T | null }> {
  return page.evaluate(async url => {
    const response = await fetch(url, { credentials: 'include' })
    const payload = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, data: payload }
  }, endpoint)
}

export async function postJson<T = unknown>(
  page: Page,
  endpoint: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: T | null }> {
  return page.evaluate(
    async ({ url, payload }) => {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      })
      const responsePayload = await response.json().catch(() => null)
      return { ok: response.ok, status: response.status, data: responsePayload }
    },
    { url: endpoint, payload: body }
  )
}

export async function openDepositDetail(page: Page, depositId: string): Promise<void> {
  await page.goto(`/reconciliation/${depositId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('load')
}

export async function isDepositDetailNotFound(page: Page): Promise<boolean> {
  const heading = page.getByRole('heading', { name: 'This page could not be found.' })
  if ((await heading.count()) === 0) {
    return false
  }

  return heading.first().isVisible().catch(() => false)
}

export async function waitForRowCheckbox(
  page: Page,
  rowId: string,
  timeout = 5_000
): Promise<boolean> {
  const checkbox = page.getByRole('checkbox', { name: `Select row ${rowId}` })
  try {
    await checkbox.waitFor({ state: 'visible', timeout })
    return true
  } catch {
    return false
  }
}

export async function selectRowCheckbox(page: Page, rowId: string): Promise<void> {
  const checkbox = page.getByRole('checkbox', { name: `Select row ${rowId}` })
  await checkbox.waitFor({ state: 'visible' })
  await checkbox.click()
}

export function buildBlockedResult(
  scenario: ScenarioManifestEntry,
  startedAt: string,
  reason: string,
  notes: string[] = []
): ScenarioResult {
  return {
    scenarioId: scenario.scenarioId,
    title: scenario.title,
    lane: scenario.lane,
    status: 'blocked',
    startedAt,
    finishedAt: new Date().toISOString(),
    reason,
    notes,
    artifacts: [],
    execution: scenario.execution,
  }
}
