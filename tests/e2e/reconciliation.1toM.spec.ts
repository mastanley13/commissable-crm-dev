import { expect, test } from '@playwright/test'
import {
  findOneToManyScenario,
  openDepositDetail,
  openMatchWizard,
  selectLine,
  selectSchedule,
  waitForSchedule,
} from './helpers/reconciliation-workflows'

test.describe('PW-02 1:M split allocation workflow', () => {
  test('opens the match wizard in 1:M mode for one line and multiple schedules', async ({ page }) => {
    const scenario = await findOneToManyScenario(page)
    test.skip(!scenario, 'No PW-02 candidate scenario found in this environment.')

    await openDepositDetail(page, scenario!.depositId)
    await selectLine(page, scenario!.lineId)
    await waitForSchedule(page, scenario!.scheduleIds[0])
    await waitForSchedule(page, scenario!.scheduleIds[1])
    await selectSchedule(page, scenario!.scheduleIds[0])
    await selectSchedule(page, scenario!.scheduleIds[1])

    const dialog = await openMatchWizard(page)
    await expect(dialog).toContainText('Match Type')
    await expect(dialog).toContainText('1:M')
    await expect(dialog).toContainText('Selected deposit lines and target schedule preview')
  })
})
