import { expect, test } from '@playwright/test'
import {
  findVarianceScenario,
  getPrimaryMatchButton,
  openDepositDetail,
  selectLine,
  selectSchedule,
  waitForSchedule,
} from './helpers/reconciliation-workflows'

test.describe('PW-04 variance and rate review workflow', () => {
  test('opens the reconciliation alert when a match requires operator review', async ({ page }) => {
    const scenario = await findVarianceScenario(page)
    test.skip(!scenario, 'No PW-04 candidate scenario found in this environment.')

    await openDepositDetail(page, scenario!.depositId)
    await selectLine(page, scenario!.lineId)
    await waitForSchedule(page, scenario!.scheduleId)
    await selectSchedule(page, scenario!.scheduleId)

    await getPrimaryMatchButton(page).click()

    const dialog = page.getByRole('dialog', { name: 'Reconciliation match wizard' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/Variance resolution required|Resolution Needed|Warnings/i)
  })
})
