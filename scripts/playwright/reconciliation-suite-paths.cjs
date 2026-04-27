const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..', '..')
const artifactsRoot = path.join(rootDir, '.artifacts', 'playwright')
const suiteRoot = path.join(artifactsRoot, 'reconciliation-suite')
const suiteHistoryDir = path.join(suiteRoot, 'history')
const suiteLatestPath = path.join(suiteRoot, 'latest.json')
const suiteLatestPartialPath = path.join(suiteRoot, 'latest-partial.json')

function listLegacySuiteRunDirs() {
  if (!fs.existsSync(suiteRoot)) return []

  return fs
    .readdirSync(suiteRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== 'history')
    .map(entry => path.join(suiteRoot, entry.name))
    .sort((a, b) => path.basename(b).localeCompare(path.basename(a)))
}

function listSuiteRunDirs() {
  const historyDirs = fs.existsSync(suiteHistoryDir)
    ? fs
        .readdirSync(suiteHistoryDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(suiteHistoryDir, entry.name))
        .sort((a, b) => path.basename(b).localeCompare(path.basename(a)))
    : []

  return [...historyDirs, ...listLegacySuiteRunDirs()]
}

function resolveSuiteRunDir(runArg) {
  if (runArg) {
    const explicitPath = path.isAbsolute(runArg) ? runArg : path.resolve(rootDir, runArg)
    const historyPath = path.join(suiteHistoryDir, runArg)
    const legacyPath = path.join(suiteRoot, runArg)

    if (fs.existsSync(explicitPath)) return explicitPath
    if (fs.existsSync(historyPath)) return historyPath
    if (fs.existsSync(legacyPath)) return legacyPath

    throw new Error(`Could not resolve reconciliation suite run "${runArg}".`)
  }

  if (fs.existsSync(suiteLatestPath)) {
    const latest = JSON.parse(fs.readFileSync(suiteLatestPath, 'utf8'))
    if (latest.runDir && fs.existsSync(latest.runDir)) {
      return latest.runDir
    }
  }

  const firstRun = listSuiteRunDirs()[0]
  if (firstRun) return firstRun

  throw new Error('No reconciliation suite Playwright run was found.')
}

module.exports = {
  artifactsRoot,
  rootDir,
  suiteHistoryDir,
  suiteLatestPath,
  suiteLatestPartialPath,
  suiteRoot,
  listSuiteRunDirs,
  resolveSuiteRunDir,
}
