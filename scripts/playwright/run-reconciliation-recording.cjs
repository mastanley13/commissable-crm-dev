const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { rootDir, suiteHistoryDir } = require('./reconciliation-suite-paths.cjs')

function timestampRunId(prefix) {
  const now = new Date()
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('-')

  return `${prefix}-${date}_${time}`
}

function parseArgs(args) {
  const parsed = {
    demo: false,
    convertMp4: false,
    runId: '',
    passthrough: [],
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--demo') {
      parsed.demo = true
    } else if (arg === '--convert-mp4') {
      parsed.convertMp4 = true
    } else if (arg === '--run-id') {
      parsed.runId = args[index + 1] ?? ''
      index += 1
    } else if (arg.startsWith('--run-id=')) {
      parsed.runId = arg.slice('--run-id='.length)
    } else {
      parsed.passthrough.push(arg)
    }
  }

  return parsed
}

function loadDotEnvFile(filePath, env) {
  if (!fs.existsSync(filePath)) return

  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const equalsIndex = line.indexOf('=')
    if (equalsIndex === -1) continue

    const name = line.slice(0, equalsIndex).trim()
    let value = line.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (name && env[name] == null) {
      env[name] = value
    }
  }
}

function runNodeScript(scriptPath, args, env) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: rootDir,
    stdio: 'inherit',
    env,
  })

  return typeof result.status === 'number' ? result.status : 1
}

function findFfmpeg() {
  const command = process.platform === 'win32' ? 'where' : 'which'
  const result = spawnSync(command, ['ffmpeg'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) return ''
  return result.stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? ''
}

function convertWebmVideos(runDir) {
  const ffmpegPath = findFfmpeg()
  if (!ffmpegPath) {
    console.warn('Skipping MP4 conversion because ffmpeg was not found on PATH.')
    return 0
  }

  const indexPath = path.join(runDir, 'video-index.json')
  if (!fs.existsSync(indexPath)) {
    console.warn('Skipping MP4 conversion because video-index.json was not found.')
    return 0
  }

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  const mp4Dir = path.join(runDir, 'videos', 'mp4')
  fs.mkdirSync(mp4Dir, { recursive: true })

  let converted = 0
  for (const scenario of index.scenarios ?? []) {
    for (const videoPath of scenario.videoPaths ?? []) {
      if (path.extname(videoPath).toLowerCase() !== '.webm') continue

      const sourcePath = path.resolve(runDir, videoPath)
      if (!fs.existsSync(sourcePath)) continue

      const targetPath = path.join(mp4Dir, `${scenario.scenarioId}.mp4`)
      const result = spawnSync(
        ffmpegPath,
        ['-y', '-i', sourcePath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', targetPath],
        {
          cwd: rootDir,
          stdio: 'inherit',
        }
      )

      if (result.status !== 0) return typeof result.status === 'number' ? result.status : 1
      converted += 1
    }
  }

  console.log(`Converted ${converted} videos to ${mp4Dir}`)
  return 0
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const runId =
    options.runId ||
    process.env.PLAYWRIGHT_RUN_ID ||
    timestampRunId(options.demo ? 'demo-recording' : 'full-recording')
  const runDir = path.join(suiteHistoryDir, runId)
  const env = { ...process.env }

  loadDotEnvFile(path.join(rootDir, '.env'), env)
  loadDotEnvFile(path.join(rootDir, '.env.local'), env)

  env.PLAYWRIGHT_RUN_ID = runId
  env.PLAYWRIGHT_RUN_DIR = runDir
  env.PLAYWRIGHT_VIDEO = env.PLAYWRIGHT_VIDEO ?? 'on'
  env.PLAYWRIGHT_TRACE = env.PLAYWRIGHT_TRACE ?? 'on'
  env.PLAYWRIGHT_WORKERS = env.PLAYWRIGHT_WORKERS ?? '1'

  const playwrightArgs = [...options.passthrough]
  if (options.demo && !playwrightArgs.includes('--grep')) {
    playwrightArgs.push('--grep', '\\[(RS-001|RS-004|RS-068|RS-069|RS-073)\\]')
  }

  console.log(`Starting reconciliation recording run: ${runId}`)
  console.log(`Run directory: ${runDir}`)
  console.log(`Video mode: ${env.PLAYWRIGHT_VIDEO}`)
  console.log(`Trace mode: ${env.PLAYWRIGHT_TRACE}`)

  const runStatus = runNodeScript(path.join(__dirname, 'run-reconciliation-suite.cjs'), playwrightArgs, env)
  const indexStatus = runNodeScript(path.join(__dirname, 'generate-reconciliation-video-index.cjs'), [runDir], env)
  const convertStatus = options.convertMp4 ? convertWebmVideos(runDir) : 0

  if (runStatus !== 0) {
    console.warn(`Reconciliation recording completed with test exit code ${runStatus}.`)
  }

  process.exit(runStatus || indexStatus || convertStatus)
}

main()
