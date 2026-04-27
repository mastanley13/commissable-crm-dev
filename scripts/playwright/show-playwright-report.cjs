const fs = require('fs')
const net = require('net')
const path = require('path')
const { spawnSync } = require('child_process')

const rootDir = path.resolve(__dirname, '..', '..')
const artifactsRoot = path.join(rootDir, '.artifacts', 'playwright')
const manifestPath = path.join(artifactsRoot, 'latest-run.json')

function resolveNpx() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

function resolveRunDir(arg) {
  if (arg) {
    return path.join(artifactsRoot, 'history', arg)
  }

  if (!fs.existsSync(manifestPath)) {
    throw new Error('No Playwright run manifest found. Run npm run pw:test first.')
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  return manifest.runDir
}

function reserveOpenPort(preferredPort = 9323) {
  return new Promise((resolve, reject) => {
    const tryListen = port => {
      const server = net.createServer()

      server.unref()
      server.on('error', error => {
        if (error && error.code === 'EADDRINUSE') {
          tryListen(0)
          return
        }
        reject(error)
      })

      server.listen(port, '127.0.0.1', () => {
        const address = server.address()
        const resolvedPort = address && typeof address === 'object' ? address.port : port
        server.close(closeError => {
          if (closeError) {
            reject(closeError)
            return
          }
          resolve(resolvedPort)
        })
      })
    }

    tryListen(preferredPort)
  })
}

async function main() {
  const requestedRunId = process.argv[2]
  const runDir = resolveRunDir(requestedRunId)
  const htmlDir = path.join(runDir, 'html')

  if (!fs.existsSync(htmlDir)) {
    throw new Error(`Playwright HTML report not found: ${htmlDir}`)
  }

  const port = await reserveOpenPort(Number(process.env.PLAYWRIGHT_REPORT_PORT ?? '9323'))
  console.log(`Opening Playwright report from ${htmlDir}`)
  console.log(`Using http://127.0.0.1:${port}`)

  const result = spawnSync(
    resolveNpx(),
    ['playwright', 'show-report', htmlDir, '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  )

  process.exit(typeof result.status === 'number' ? result.status : 1)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
