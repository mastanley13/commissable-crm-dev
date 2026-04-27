import { expect, type Page } from '@playwright/test'

type DepositSummary = {
  id: string
  accountName: string
  depositName: string
  status: string
  reconciled: boolean
}

type DepositListResponse = {
  data: DepositSummary[]
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
}

type DepositLineItem = {
  id: string
  status: string
  reconciled: boolean
  hasSuggestedMatches?: boolean
  accountName: string
  productName: string
  usage: number
  commission: number
}

type DepositDetailResponse = {
  data: {
    metadata: {
      id: string
      depositName: string
    }
    lineItems: DepositLineItem[]
  }
}

type ScheduleCandidate = {
  id: string
  status: string
  matchConfidence: number
  scheduleNumber?: string
  opportunityName?: string
}

type CandidatesResponse = {
  data: ScheduleCandidate[]
}

type MatchIssuesPreviewResponse = {
  data?: {
    requiresConfirmation?: boolean
    flexDecision?: { action?: string } | null
    rateDiscrepancy?: Record<string, unknown> | null
    commissionAmountReview?: { requiresAction?: boolean } | null
  }
  error?: string
}

export type OneToOneScenario = {
  depositId: string
  lineId: string
  scheduleId: string
  candidateCount: number
}

export type OneToManyScenario = {
  depositId: string
  lineId: string
  scheduleIds: [string, string]
}

export type ManyToOneScenario = {
  depositId: string
  lineIds: [string, string]
  scheduleId: string
}

export type VarianceScenario = {
  depositId: string
  lineId: string
  scheduleId: string
  trigger: 'rate' | 'flex' | 'commission'
}

type DiscoveryCache = {
  deposits?: DepositSummary[]
  details: Map<string, DepositLineItem[]>
  candidates: Map<string, ScheduleCandidate[]>
  oneToOne?: OneToOneScenario | null
  oneToMany?: OneToManyScenario | null
  manyToOne?: ManyToOneScenario | null
  variance?: VarianceScenario | null
}

const cache: DiscoveryCache = {
  details: new Map(),
  candidates: new Map(),
}

async function apiGet<T>(page: Page, url: string): Promise<T> {
  const response = await page.context().request.get(url)
  const payload = (await response.json().catch(() => null)) as T | null

  if (!response.ok || payload == null) {
    throw new Error(`GET ${url} failed with status ${response.status()}`)
  }

  return payload
}

async function apiPost<T>(page: Page, url: string, body: unknown): Promise<T> {
  const response = await page.context().request.post(url, { data: body })
  const payload = (await response.json().catch(() => null)) as T | null

  if (!response.ok || payload == null) {
    throw new Error(`POST ${url} failed with status ${response.status()}`)
  }

  return payload
}

async function listDeposits(page: Page): Promise<DepositSummary[]> {
  if (cache.deposits) return cache.deposits

  const payload = await apiGet<DepositListResponse>(page, '/api/reconciliation/deposits?page=1&pageSize=100')
  cache.deposits = Array.isArray(payload.data) ? payload.data : []
  return cache.deposits
}

async function getDepositLines(page: Page, depositId: string): Promise<DepositLineItem[]> {
  const cached = cache.details.get(depositId)
  if (cached) return cached

  const payload = await apiGet<DepositDetailResponse>(page, `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/detail`)
  const lines = Array.isArray(payload.data?.lineItems) ? payload.data.lineItems : []
  cache.details.set(depositId, lines)
  return lines
}

async function getCandidates(page: Page, depositId: string, lineId: string): Promise<ScheduleCandidate[]> {
  const key = `${depositId}:${lineId}`
  const cached = cache.candidates.get(key)
  if (cached) return cached

  const payload = await apiGet<CandidatesResponse>(
    page,
    `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/line-items/${encodeURIComponent(lineId)}/candidates?useHierarchicalMatching=true`,
  )
  const candidates = Array.isArray(payload.data) ? payload.data : []
  cache.candidates.set(key, candidates)
  return candidates
}

function isOpenLine(line: DepositLineItem) {
  return !line.reconciled && line.status !== 'Ignored'
}

export async function findOneToOneScenario(page: Page): Promise<OneToOneScenario | null> {
  if (cache.oneToOne !== undefined) return cache.oneToOne

  const deposits = await listDeposits(page)
  let fallback: OneToOneScenario | null = null

  for (const deposit of deposits) {
    const lines = await getDepositLines(page, deposit.id)
    for (const line of lines) {
      if (!isOpenLine(line)) continue
      const candidates = await getCandidates(page, deposit.id, line.id)
      if (candidates.length === 0) continue

      const scenario = {
        depositId: deposit.id,
        lineId: line.id,
        scheduleId: candidates[0]!.id,
        candidateCount: candidates.length,
      }

      if (candidates.length === 1) {
        cache.oneToOne = scenario
        return scenario
      }

      if (!fallback) {
        fallback = scenario
      }
    }
  }

  cache.oneToOne = fallback
  return fallback
}

export async function findOneToManyScenario(page: Page): Promise<OneToManyScenario | null> {
  if (cache.oneToMany !== undefined) return cache.oneToMany

  const deposits = await listDeposits(page)
  for (const deposit of deposits) {
    const lines = await getDepositLines(page, deposit.id)
    for (const line of lines) {
      if (!isOpenLine(line)) continue
      const candidates = await getCandidates(page, deposit.id, line.id)
      if (candidates.length >= 2) {
        const scenario = {
          depositId: deposit.id,
          lineId: line.id,
          scheduleIds: [candidates[0]!.id, candidates[1]!.id] as [string, string],
        }
        cache.oneToMany = scenario
        return scenario
      }
    }
  }

  cache.oneToMany = null
  return null
}

export async function findManyToOneScenario(page: Page): Promise<ManyToOneScenario | null> {
  if (cache.manyToOne !== undefined) return cache.manyToOne

  const deposits = await listDeposits(page)
  for (const deposit of deposits) {
    const lines = (await getDepositLines(page, deposit.id)).filter(isOpenLine)
    if (lines.length < 2) continue

    const scheduleToLineIds = new Map<string, string[]>()

    for (const line of lines) {
      const candidates = await getCandidates(page, deposit.id, line.id)
      for (const candidate of candidates) {
        const existing = scheduleToLineIds.get(candidate.id) ?? []
        if (!existing.includes(line.id)) {
          existing.push(line.id)
        }
        scheduleToLineIds.set(candidate.id, existing)
      }
    }

    for (const [scheduleId, lineIds] of scheduleToLineIds.entries()) {
      if (lineIds.length >= 2) {
        const scenario = {
          depositId: deposit.id,
          lineIds: [lineIds[0]!, lineIds[1]!] as [string, string],
          scheduleId,
        }
        cache.manyToOne = scenario
        return scenario
      }
    }
  }

  cache.manyToOne = null
  return null
}

export async function findVarianceScenario(page: Page): Promise<VarianceScenario | null> {
  if (cache.variance !== undefined) return cache.variance

  const deposits = await listDeposits(page)
  for (const deposit of deposits) {
    const lines = await getDepositLines(page, deposit.id)
    for (const line of lines) {
      if (!isOpenLine(line)) continue
      const candidates = await getCandidates(page, deposit.id, line.id)
      for (const candidate of candidates.slice(0, 3)) {
        const payload = await apiPost<MatchIssuesPreviewResponse>(
          page,
          `/api/reconciliation/deposits/${encodeURIComponent(deposit.id)}/line-items/${encodeURIComponent(line.id)}/match-issues-preview`,
          {
            revenueScheduleId: candidate.id,
          },
        )
        const data = payload.data
        if (!data?.requiresConfirmation) continue

        const trigger: VarianceScenario['trigger'] =
          data.rateDiscrepancy
            ? 'rate'
            : data.flexDecision?.action === 'prompt'
              ? 'flex'
              : 'commission'

        const scenario = {
          depositId: deposit.id,
          lineId: line.id,
          scheduleId: candidate.id,
          trigger,
        }
        cache.variance = scenario
        return scenario
      }
    }
  }

  cache.variance = null
  return null
}

export async function openDepositDetail(page: Page, depositId: string) {
  await page.goto(`/reconciliation/${encodeURIComponent(depositId)}`)
  await expect(page.getByPlaceholder('Search deposit line items')).toBeVisible()
  await expect(page.getByPlaceholder('Search revenue schedules')).toBeVisible()
}

export async function selectLine(page: Page, lineId: string) {
  const checkbox = page.getByRole('checkbox', { name: `Select row ${lineId}` })
  await checkbox.waitFor({ state: 'visible' })
  await checkbox.click()
}

export async function selectSchedule(page: Page, scheduleId: string) {
  const checkbox = page.getByRole('checkbox', { name: `Select row ${scheduleId}` })
  await checkbox.waitFor({ state: 'visible' })
  await checkbox.click()
}

export async function waitForSchedule(page: Page, scheduleId: string) {
  await page.getByRole('checkbox', { name: `Select row ${scheduleId}` }).waitFor({ state: 'visible' })
}

export async function openMatchWizard(page: Page) {
  await getPrimaryMatchButton(page).click()
  const dialog = page.getByRole('dialog', { name: 'Reconciliation match wizard' })
  await expect(dialog).toBeVisible()
  return dialog
}

export function getPrimaryMatchButton(page: Page) {
  return page.getByTitle('Match the selected line item to the selected schedule').last()
}
