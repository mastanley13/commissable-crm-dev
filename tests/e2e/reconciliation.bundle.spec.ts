import { expect, test } from '@playwright/test'
import {
  findManyToOneScenario,
  openDepositDetail,
  openMatchWizard,
  selectLine,
  selectSchedule,
  waitForSchedule,
} from './helpers/reconciliation-workflows'

test.describe('PW-05 bundle and rip-replace workflow', () => {
  test('switches a many-to-one wizard into bundle mode without applying changes', async ({ page }) => {
    const scenario = await findManyToOneScenario(page)
    test.skip(!scenario, 'No PW-05 candidate scenario found in this environment.')

    await openDepositDetail(page, scenario!.depositId)
    await selectLine(page, scenario!.lineIds[0])
    await waitForSchedule(page, scenario!.scheduleId)
    await selectLine(page, scenario!.lineIds[1])
    await selectSchedule(page, scenario!.scheduleId)

    const dialog = await openMatchWizard(page)

    const bundleToggle = dialog.getByRole('button', { name: /^Bundle Instead$/ })
    await expect(bundleToggle).toBeVisible()
    await bundleToggle.click()

    await expect(dialog).toContainText(/Replace mode|Reason \(optional\)|Reason \(required for audit\)/i)
    await expect(dialog.getByRole('button', { name: /Create bundle schedules|Confirm replacement/i })).toBeVisible()
  })
})
