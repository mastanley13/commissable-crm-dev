import { expect, test } from '@playwright/test'
import {
  findOneToOneScenario,
  getPrimaryMatchButton,
  openDepositDetail,
  selectLine,
  selectSchedule,
  waitForSchedule,
} from './helpers/reconciliation-workflows'

test.describe('PW-01 1:1 exact and metadata-assisted matching', () => {
  test('loads a 1:1 candidate set and enables the direct match workflow', async ({ page }) => {
    const scenario = await findOneToOneScenario(page)
    test.skip(!scenario, 'No PW-01 candidate scenario found in this environment.')

    await openDepositDetail(page, scenario!.depositId)
    await selectLine(page, scenario!.lineId)
    await waitForSchedule(page, scenario!.scheduleId)
    await selectSchedule(page, scenario!.scheduleId)

    const matchButton = getPrimaryMatchButton(page)
    await expect(matchButton).toBeEnabled()
    await expect(page.getByPlaceholder('Search revenue schedules')).toBeVisible()
  })
})
