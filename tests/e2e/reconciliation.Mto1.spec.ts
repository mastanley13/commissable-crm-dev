import { expect, test } from '@playwright/test'
import {
  findManyToOneScenario,
  openDepositDetail,
  openMatchWizard,
  selectLine,
  selectSchedule,
  waitForSchedule,
} from './helpers/reconciliation-workflows'

test.describe('PW-03 M:1 rollup workflow', () => {
  test('opens the match wizard in M:1 mode for multiple lines and one schedule', async ({ page }) => {
    const scenario = await findManyToOneScenario(page)
    test.skip(!scenario, 'No PW-03 candidate scenario found in this environment.')

    await openDepositDetail(page, scenario!.depositId)
    await selectLine(page, scenario!.lineIds[0])
    await waitForSchedule(page, scenario!.scheduleId)
    await selectLine(page, scenario!.lineIds[1])
    await selectSchedule(page, scenario!.scheduleId)

    const dialog = await openMatchWizard(page)
    await expect(dialog).toContainText('Match Type')
    await expect(dialog).toContainText('M:1')
    await expect(dialog).toContainText('Inline allocation editing is active')
    await expect(dialog).toContainText('Bundle Instead')
  })
})
