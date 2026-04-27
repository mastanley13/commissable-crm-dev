import { expect, type Page } from '@playwright/test'

function requireEnv(name: 'PLAYWRIGHT_EMAIL' | 'PLAYWRIGHT_PASSWORD'): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export async function login(page: Page) {
  const email = requireEnv('PLAYWRIGHT_EMAIL')
  const password = requireEnv('PLAYWRIGHT_PASSWORD')

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible()

  await page.getByLabel(/email address/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL(/\/accounts(?:\/)?$/, { timeout: 30_000 })
  await expect(page).toHaveURL(/\/accounts(?:\/)?$/)
}
