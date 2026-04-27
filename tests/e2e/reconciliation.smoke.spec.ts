import { expect, test } from '@playwright/test'

test.describe('reconciliation smoke', () => {
  test('can sign in and open the reconciliation list', async ({ page }) => {
    await page.goto('/reconciliation')

    await expect(page.getByText('DEPOSITS LIST')).toBeVisible()
    await expect(page.getByPlaceholder('Search reconciliation...')).toBeVisible()

    const emptyState = page.getByText('No reconciliation records found')
    const firstRow = page.locator('.table-grid .table-row').first()

    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible()
      return
    }

    await expect(firstRow).toBeVisible()
  })

  test('can open a reconciliation deposit detail when a deposit exists', async ({ page }) => {
    await page.goto('/reconciliation')
    await expect(page.getByText('DEPOSITS LIST')).toBeVisible()

    const emptyState = page.getByText('No reconciliation records found')
    if (await emptyState.isVisible()) {
      test.skip(true, 'No deposits are available in this environment.')
    }

    const firstRow = page.locator('.table-grid .table-row').first()
    await expect(firstRow).toBeVisible()

    await firstRow.locator('.table-cell').nth(1).click()

    await expect(page.getByPlaceholder('Search deposit line items')).toBeVisible()
    await expect(page.getByPlaceholder('Search revenue schedules')).toBeVisible()
  })
})
