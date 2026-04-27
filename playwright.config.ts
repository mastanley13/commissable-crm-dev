import path from 'path'
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'
const parsedBaseURL = new URL(baseURL)
const nextCliPath = require.resolve('next/dist/bin/next')
const nextDevCommand = [
  JSON.stringify(process.execPath),
  JSON.stringify(nextCliPath),
  'dev',
  '--hostname',
  parsedBaseURL.hostname,
  '--port',
  parsedBaseURL.port || '3000',
].join(' ')
const artifactsRoot = path.join(__dirname, '.artifacts', 'playwright')
const adhocRunId = new Date().toISOString().replace(/[:.]/g, '-')
const runDir = process.env.PLAYWRIGHT_RUN_DIR ?? path.join(artifactsRoot, 'adhoc', adhocRunId)
const authFile = process.env.PLAYWRIGHT_AUTH_FILE ?? path.join(artifactsRoot, 'auth', 'user.json')
const videoMode =
  process.env.PLAYWRIGHT_VIDEO === 'on' ||
  process.env.PLAYWRIGHT_VIDEO === 'off' ||
  process.env.PLAYWRIGHT_VIDEO === 'retain-on-failure' ||
  process.env.PLAYWRIGHT_VIDEO === 'on-first-retry'
    ? process.env.PLAYWRIGHT_VIDEO
    : 'retain-on-failure'
const traceMode =
  process.env.PLAYWRIGHT_TRACE === 'on' ||
  process.env.PLAYWRIGHT_TRACE === 'off' ||
  process.env.PLAYWRIGHT_TRACE === 'retain-on-failure' ||
  process.env.PLAYWRIGHT_TRACE === 'on-first-retry' ||
  process.env.PLAYWRIGHT_TRACE === 'on-all-retries'
    ? process.env.PLAYWRIGHT_TRACE
    : 'retain-on-failure'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? (process.env.CI ? '1' : '1')),
  preserveOutput: 'always',
  outputDir: path.join(runDir, 'test-results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(runDir, 'html'), open: 'never' }],
    ['json', { outputFile: path.join(runDir, 'results.json') }],
    ['junit', { outputFile: path.join(runDir, 'results.xml') }],
  ],
  use: {
    baseURL,
    trace: traceMode,
    screenshot: 'only-on-failure',
    video: videoMode,
  },
  webServer: {
    command: nextDevCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      testIgnore: /auth\.setup\.ts/,
    },
  ],
})
