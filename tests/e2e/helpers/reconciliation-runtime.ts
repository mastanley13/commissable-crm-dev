import type { Page } from '@playwright/test'
import { loadScenarioManifest, type ScenarioManifestEntry } from '../reconciliation-suite.helpers'

type BrowserLiveScenario = ScenarioManifestEntry & {
  execution: Extract<ScenarioManifestEntry['execution'], { mode: 'browser-live' }>
}

type JsonResponse<T> = {
  ok: boolean
  status: number
  data: T | null
}

let cachedManifest: ReturnType<typeof loadScenarioManifest> | null = null

function getManifest() {
  if (!cachedManifest) {
    cachedManifest = loadScenarioManifest()
  }

  return cachedManifest
}

export function requireScenarioById(scenarioId: string): BrowserLiveScenario {
  const scenario = getManifest().scenarios.find(entry => entry.scenarioId === scenarioId)
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} was not found in the reconciliation manifest.`)
  }

  if (scenario.execution.mode !== 'browser-live') {
    throw new Error(`Scenario ${scenarioId} is not mapped to a browser-live runtime fixture.`)
  }

  return scenario as BrowserLiveScenario
}

export function requireFlowScenario(
  flowId: string,
  predicate?: (scenario: BrowserLiveScenario) => boolean
): BrowserLiveScenario {
  const scenario = getManifest().scenarios.find(entry => {
    if (entry.execution.mode !== 'browser-live' || entry.execution.flowId !== flowId) {
      return false
    }

    return predicate ? predicate(entry as BrowserLiveScenario) : true
  })

  if (!scenario || scenario.execution.mode !== 'browser-live') {
    throw new Error(`No browser-live scenario was found for flow ${flowId}.`)
  }

  return scenario as BrowserLiveScenario
}

export async function requestJson<T>(
  page: Page,
  method: 'GET' | 'POST',
  url: string,
  body?: unknown
): Promise<JsonResponse<T>> {
  const response =
    method === 'GET'
      ? await page.context().request.get(url)
      : await page.context().request.post(url, body === undefined ? undefined : { data: body })

  const payload = (await response.json().catch(() => null)) as T | null
  return {
    ok: response.ok(),
    status: response.status(),
    data: payload,
  }
}

export async function fetchDepositDetail(page: Page, depositId: string) {
  return requestJson<{
    data?: {
      lineItems?: Array<{
        id?: string
        status?: string
        usage?: number
        commission?: number
        usageAllocated?: number
        usageUnallocated?: number
        commissionAllocated?: number
        commissionUnallocated?: number
      }>
    }
  }>(page, 'GET', `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/detail`)
}

export async function fetchCandidateRows(page: Page, depositId: string, lineId: string) {
  return requestJson<{
    data?: Array<{
      id?: string
      status?: string
      matchConfidence?: number
    }>
  }>(
    page,
    'GET',
    `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/line-items/${encodeURIComponent(lineId)}/candidates`
  )
}

export async function applyLineMatch(
  page: Page,
  params: {
    depositId: string
    lineId: string
    scheduleId: string
    usageAmount: number
    commissionAmount: number
    confidenceScore?: number
  }
) {
  const { depositId, lineId, scheduleId, usageAmount, commissionAmount, confidenceScore = 0.99 } = params
  return requestJson<any>(
    page,
    'POST',
    `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/line-items/${encodeURIComponent(lineId)}/apply-match`,
    {
      revenueScheduleId: scheduleId,
      usageAmount,
      commissionAmount,
      confidenceScore,
    }
  )
}

export async function unmatchLine(page: Page, depositId: string, lineId: string) {
  return requestJson<any>(
    page,
    'POST',
    `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/line-items/${encodeURIComponent(lineId)}/unmatch`
  )
}
