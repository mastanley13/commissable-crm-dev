import fs from 'fs'
import path from 'path'
import { test as setup } from '@playwright/test'
import { login } from './helpers/auth'

const authFile =
  process.env.PLAYWRIGHT_AUTH_FILE ??
  path.join(process.cwd(), '.artifacts', 'playwright', 'auth', 'user.json')

setup('authenticate and save browser state', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  await login(page)
  await page.context().storageState({ path: authFile })
})
