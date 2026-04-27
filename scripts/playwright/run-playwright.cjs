const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const rootDir = path.resolve(__dirname, '..', '..')
const artifactsRoot = path.join(rootDir, '.artifacts', 'playwright')
const historyDir = path.join(artifactsRoot, 'history')
const authDir = path.join(artifactsRoot, 'auth')

function timestampRunId() {
  const now = new Date()
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ]
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ]

  return `${parts.join('-')}_${time.join('-')}`
}

function resolveNpx() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

const runId = process.env.PLAYWRIGHT_RUN_ID ?? timestampRunId()
const runDir = path.join(historyDir, runId)
const authFile = process.env.PLAYWRIGHT_AUTH_FILE ?? path.join(authDir, 'user.json')
const startedAt = new Date().toISOString()

fs.mkdirSync(runDir, { recursive: true })
fs.mkdirSync(path.dirname(authFile), { recursive: true })

const manifestPath = path.join(artifactsRoot, 'latest-run.json')
const metadataPath = path.join(runDir, 'run-metadata.json')
const cliArgs = process.argv.slice(2)

const result = spawnSync(resolveNpx(), ['playwright', 'test', ...cliArgs], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    PLAYWRIGHT_RUN_ID: runId,
    PLAYWRIGHT_RUN_DIR: runDir,
    PLAYWRIGHT_AUTH_FILE: authFile,
  },
})

const finishedAt = new Date().toISOString()
const exitCode = typeof result.status === 'number' ? result.status : 1

const manifest = {
  runId,
  runDir,
  authFile,
  startedAt,
  finishedAt,
  exitCode,
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
}

fs.mkdirSync(artifactsRoot, { recursive: true })
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
fs.writeFileSync(metadataPath, `${JSON.stringify(manifest, null, 2)}\n`)

process.exit(exitCode)
