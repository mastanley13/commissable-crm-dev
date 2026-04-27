import { expect, test } from '@playwright/test'
import {
  applyLineMatch,
  fetchCandidateRows,
  fetchDepositDetail,
  requireFlowScenario,
  requireScenarioById,
  unmatchLine,
} from './helpers/reconciliation-runtime'
import {
  getPrimaryMatchButton,
  openDepositDetail,
  selectLine,
  selectSchedule,
  waitForSchedule,
} from './helpers/reconciliation-workflows'

test.describe('PW-08 unmatched and partial-match workflows', () => {
  test('keeps the generic unmatched fixture open with no suggested matches', async ({ page }) => {
    const scenario = requireScenarioById('RS-073')
    const { depositId, lineId } = scenario.execution

    await openDepositDetail(page, depositId)
    await selectLine(page, lineId)

    const candidates = await fetchCandidateRows(page, depositId, lineId)
    expect(candidates.ok).toBeTruthy()
    expect(candidates.data?.data ?? []).toHaveLength(0)

    await expect(page.getByText('No suggested matches found')).toBeVisible()
    await expect(getPrimaryMatchButton(page)).toBeDisabled()
  })

  test('applies and restores a partial match on the seeded partial-review fixture', async ({ page }) => {
    const scenario = requireFlowScenario('generic-partial-review')
    const { depositId, lineId, scheduleIds } = scenario.execution
    const scheduleId = scheduleIds[0]
    expect(scheduleId).toBeTruthy()

    await openDepositDetail(page, depositId)
    await selectLine(page, lineId)
    await waitForSchedule(page, scheduleId!)
    await selectSchedule(page, scheduleId!)

    let applied = false

    try {
      const applyResponse = await applyLineMatch(page, {
        depositId,
        lineId,
        scheduleId: scheduleId!,
        usageAmount: 300,
        commissionAmount: 24,
      })
      expect(applyResponse.ok).toBeTruthy()
      applied = true

      const detailAfterApply = await fetchDepositDetail(page, depositId)
      expect(detailAfterApply.ok).toBeTruthy()
      const detailLine = (detailAfterApply.data?.data?.lineItems ?? []).find(line => line?.id === lineId)
      expect(detailLine?.status).toBe('Partially Matched')
      expect(Number(detailLine?.usageAllocated ?? -1)).toBe(300)
      expect(Number(detailLine?.commissionAllocated ?? -1)).toBe(24)

      await openDepositDetail(page, depositId)
      await expect(page.getByText('Partially Matched')).toBeVisible()
    } finally {
      if (applied) {
        const unmatchResponse = await unmatchLine(page, depositId, lineId)
        expect(unmatchResponse.ok).toBeTruthy()

        const restoredDetail = await fetchDepositDetail(page, depositId)
        expect(restoredDetail.ok).toBeTruthy()
        const restoredLine = (restoredDetail.data?.data?.lineItems ?? []).find(line => line?.id === lineId)
        expect(restoredLine?.status).toBe('Unmatched')
      }
    }
  })
})
