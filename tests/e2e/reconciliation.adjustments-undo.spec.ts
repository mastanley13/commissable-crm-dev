import { expect, test } from '@playwright/test'
import {
  applyLineMatch,
  fetchDepositDetail,
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

test.describe('PW-06 adjustment and undo workflows', () => {
  test('loads the mapped negative-variance adjustment scenario in the browser', async ({ page }) => {
    const scenario = requireScenarioById('RS-081')
    const { depositId, lineId, scheduleIds } = scenario.execution
    const scheduleId = scheduleIds[0]
    expect(scheduleId).toBeTruthy()

    await openDepositDetail(page, depositId)
    await selectLine(page, lineId)
    await waitForSchedule(page, scheduleId!)
    await selectSchedule(page, scheduleId!)

    await expect(getPrimaryMatchButton(page)).toBeEnabled()
    await expect(page.getByPlaceholder('Search revenue schedules')).toBeVisible()
  })

  test('restores a fully matched line to unmatched through the live undo path', async ({ page }) => {
    const scenario = requireScenarioById('RS-007')
    const { depositId, lineId, scheduleIds } = scenario.execution
    const scheduleId = scheduleIds[0]
    expect(scheduleId).toBeTruthy()

    const detailBeforeApply = await fetchDepositDetail(page, depositId)
    expect(detailBeforeApply.ok).toBeTruthy()
    const sourceLine = (detailBeforeApply.data?.data?.lineItems ?? []).find(line => line?.id === lineId)
    expect(sourceLine).toBeTruthy()

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
        usageAmount: Number(sourceLine?.usage ?? 0),
        commissionAmount: Number(sourceLine?.commission ?? 0),
      })
      expect(applyResponse.ok).toBeTruthy()
      applied = true

      const detailAfterApply = await fetchDepositDetail(page, depositId)
      expect(detailAfterApply.ok).toBeTruthy()
      const matchedLine = (detailAfterApply.data?.data?.lineItems ?? []).find(line => line?.id === lineId)
      expect(matchedLine?.status).toBe('Matched')

      const unmatchResponse = await unmatchLine(page, depositId, lineId)
      expect(unmatchResponse.ok).toBeTruthy()

      const restoredDetail = await fetchDepositDetail(page, depositId)
      expect(restoredDetail.ok).toBeTruthy()
      const restoredLine = (restoredDetail.data?.data?.lineItems ?? []).find(line => line?.id === lineId)
      expect(restoredLine?.status).toBe('Unmatched')
      expect(Number(restoredLine?.usageAllocated ?? -1)).toBe(0)
      expect(Number(restoredLine?.commissionAllocated ?? -1)).toBe(0)
      applied = false
    } finally {
      if (applied) {
        await unmatchLine(page, depositId, lineId)
      }
    }
  })
})
