import fs from 'fs'
import path from 'path'

export type ReconciliationScenarioStatus =
  | 'pass'
  | 'blocked'
  | 'fail'
  | 'pass-pending-ui-review'
  | 'not-recorded'

export type ReconciliationScenarioLane =
  | 'deterministic'
  | 'ui-review'
  | 'needs-clarification'
  | 'known-bug'

export interface ReconciliationRunPointer {
  runId: string
  runDir: string
  suiteName: 'reconciliation-suite'
  generatedAt: string
  scenarioCount: number
  isFullSuiteRun: boolean
  statusCounts: Record<string, number>
  reconciliationSummaryJson: string
}

interface InternalReconciliationRunMetadata {
  runId: string
  runDir: string
  suiteName: 'reconciliation-suite'
  startedAt: string | null
  finishedAt: string | null
  exitCode: number | null
  baseURL: string
  authFile: string
  environmentLabel: string
  fixtureVersion: string
  scenarioManifestPath: string
  scenarioManifestGeneratedAt: string | null
  scenarioCount: number | null
  isFullSuiteRun: boolean
  gitCommit: string | null
  statusCounts: Record<string, number> | null
  artifactPaths: Record<string, string>
}

export interface ReconciliationRunMetadata {
  runId: string
  suiteName: 'reconciliation-suite'
  startedAt: string | null
  finishedAt: string | null
  exitCode: number | null
  environmentLabel: string
  fixtureVersion: string
  scenarioManifestGeneratedAt: string | null
  scenarioCount: number | null
  isFullSuiteRun: boolean
  statusCounts: Record<string, number> | null
}

export interface ReconciliationScenarioRow {
  scenarioId: string
  group: string
  title: string
  lane: ReconciliationScenarioLane
  status: ReconciliationScenarioStatus
  reason: string
  notes: string
  executionMode: string
  flowId: string
  depositId: string
  lineId: string
  scheduleIds: string
  artifactPaths: string
}

export interface ReconciliationReasonCount {
  reason: string
  count: number
}

export interface ReconciliationSummaryPayload {
  runId: string
  runMetadata: ReconciliationRunMetadata | null
  summary: {
    total: number
    statusCounts: Record<string, number>
    laneCounts: Record<string, number>
    passes: ReconciliationScenarioRow[]
    pendingUiReview: ReconciliationScenarioRow[]
    runtimePathValidations: ReconciliationScenarioRow[]
    failures: ReconciliationScenarioRow[]
    blocked: ReconciliationScenarioRow[]
    notRecorded: ReconciliationScenarioRow[]
    failureReasons: ReconciliationReasonCount[]
    blockedReasons: ReconciliationReasonCount[]
  }
  rows: ReconciliationScenarioRow[]
}

export interface ReconciliationRunSummary {
  pointer: ReconciliationRunPointer | null
  payload: ReconciliationSummaryPayload | null
}

const rootDir = process.cwd()
const artifactsRoot = path.join(rootDir, '.artifacts', 'playwright')
const suiteRoot = path.join(artifactsRoot, 'reconciliation-suite')
const suiteHistoryDir = path.join(suiteRoot, 'history')
const latestFullPath = path.join(suiteRoot, 'latest.json')
const latestPartialPath = path.join(suiteRoot, 'latest-partial.json')
const ALLOWED_ARTIFACT_CONTENT_TYPES = new Map<string, string>([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webm', 'video/webm'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
])

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

function normalizeRunDir(runDir: string): string {
  return path.resolve(runDir)
}

function resolveRunDir(runId: string, preferredRunDir?: string): string {
  const committedRunDir = path.join(suiteHistoryDir, runId)
  if (fileExists(committedRunDir)) {
    return committedRunDir
  }

  if (preferredRunDir && fileExists(preferredRunDir)) {
    return normalizeRunDir(preferredRunDir)
  }

  return committedRunDir
}

function buildRunPointer(
  metadata: Pick<
    InternalReconciliationRunMetadata,
    'runId' | 'suiteName' | 'finishedAt' | 'startedAt' | 'scenarioCount' | 'isFullSuiteRun' | 'statusCounts'
  >,
  runDir: string
): ReconciliationRunPointer {
  return {
    runId: metadata.runId,
    runDir,
    suiteName: metadata.suiteName,
    generatedAt: metadata.finishedAt ?? metadata.startedAt ?? '',
    scenarioCount: metadata.scenarioCount ?? 0,
    isFullSuiteRun: metadata.isFullSuiteRun,
    statusCounts: metadata.statusCounts ?? {},
    reconciliationSummaryJson: path.join(runDir, 'reconciliation-summary.json'),
  }
}

function readRunMetadata(runDir: string): InternalReconciliationRunMetadata | null {
  const metadataPath = path.join(runDir, 'run-metadata.json')
  if (!fileExists(metadataPath)) {
    return null
  }

  return readJsonFile<InternalReconciliationRunMetadata>(metadataPath)
}

export function sanitizeRunMetadata(
  metadata: InternalReconciliationRunMetadata | ReconciliationRunMetadata | null | undefined
): ReconciliationRunMetadata | null {
  if (!metadata) {
    return null
  }

  return {
    runId: metadata.runId,
    suiteName: metadata.suiteName,
    startedAt: metadata.startedAt ?? null,
    finishedAt: metadata.finishedAt ?? null,
    exitCode: metadata.exitCode ?? null,
    environmentLabel: metadata.environmentLabel ?? 'unknown',
    fixtureVersion: metadata.fixtureVersion ?? 'unspecified',
    scenarioManifestGeneratedAt: metadata.scenarioManifestGeneratedAt ?? null,
    scenarioCount: metadata.scenarioCount ?? null,
    isFullSuiteRun: Boolean(metadata.isFullSuiteRun),
    statusCounts: metadata.statusCounts ?? null,
  }
}

export function sanitizeReconciliationSummaryPayload(
  payload: ReconciliationSummaryPayload | Record<string, unknown>,
  fallbackRunId: string,
  fallbackMetadata: InternalReconciliationRunMetadata | ReconciliationRunMetadata | null = null
): ReconciliationSummaryPayload {
  const raw = payload as Partial<ReconciliationSummaryPayload> & {
    runMetadata?: InternalReconciliationRunMetadata | ReconciliationRunMetadata | null
  }
  const rawSummary = raw.summary as Partial<ReconciliationSummaryPayload['summary']> | undefined

  return {
    runId: typeof raw.runId === 'string' && raw.runId.length > 0 ? raw.runId : fallbackRunId,
    runMetadata: sanitizeRunMetadata(raw.runMetadata) ?? sanitizeRunMetadata(fallbackMetadata),
    summary: {
      total: rawSummary?.total ?? 0,
      statusCounts: rawSummary?.statusCounts ?? {},
      laneCounts: rawSummary?.laneCounts ?? {},
      passes: Array.isArray(rawSummary?.passes) ? rawSummary.passes : [],
      pendingUiReview: Array.isArray(rawSummary?.pendingUiReview) ? rawSummary.pendingUiReview : [],
      runtimePathValidations: Array.isArray(rawSummary?.runtimePathValidations)
        ? rawSummary.runtimePathValidations
        : [],
      failures: Array.isArray(rawSummary?.failures) ? rawSummary.failures : [],
      blocked: Array.isArray(rawSummary?.blocked) ? rawSummary.blocked : [],
      notRecorded: Array.isArray(rawSummary?.notRecorded) ? rawSummary.notRecorded : [],
      failureReasons: Array.isArray(rawSummary?.failureReasons) ? rawSummary.failureReasons : [],
      blockedReasons: Array.isArray(rawSummary?.blockedReasons) ? rawSummary.blockedReasons : [],
    },
    rows: Array.isArray(raw.rows) ? raw.rows : [],
  }
}

export function getAllowedArtifactContentType(filePath: string): string | null {
  const extension = path.extname(filePath).toLowerCase()
  return ALLOWED_ARTIFACT_CONTENT_TYPES.get(extension) ?? null
}

function listHistoryRuns(): ReconciliationRunPointer[] {
  if (!fileExists(suiteHistoryDir)) {
    return []
  }

  return fs
    .readdirSync(suiteHistoryDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(suiteHistoryDir, entry.name))
    .filter(runDir => fileExists(path.join(runDir, 'run-metadata.json')))
    .map(runDir => {
      const metadata = readJsonFile<InternalReconciliationRunMetadata>(path.join(runDir, 'run-metadata.json'))
      return buildRunPointer(metadata, runDir)
    })
    .sort((left, right) => right.runId.localeCompare(left.runId))
}

function readRunPointer(pointerPath: string): ReconciliationRunPointer | null {
  if (!fileExists(pointerPath)) {
    return null
  }

  const pointer = readJsonFile<ReconciliationRunPointer>(pointerPath)
  const runDir = resolveRunDir(pointer.runId, pointer.runDir)

  return {
    ...pointer,
    runDir,
    reconciliationSummaryJson: path.join(runDir, 'reconciliation-summary.json'),
  }
}

export function listRecentReconciliationRuns(limit = 10): ReconciliationRunPointer[] {
  return listHistoryRuns().slice(0, limit)
}

export function getLatestReconciliationRunPointer(
  mode: 'full' | 'partial' | 'any' = 'full'
): ReconciliationRunPointer | null {
  if (mode !== 'partial' && fileExists(latestFullPath)) {
    return readRunPointer(latestFullPath)
  }

  if (mode !== 'full' && fileExists(latestPartialPath)) {
    return readRunPointer(latestPartialPath)
  }

  if (mode === 'full') {
    return listHistoryRuns().find(run => run.isFullSuiteRun) ?? null
  }

  return listHistoryRuns()[0] ?? null
}

export function readReconciliationRunSummary(
  runId?: string,
  mode: 'full' | 'partial' | 'any' = 'any'
): ReconciliationRunSummary {
  const pointer =
    runId != null
      ? listHistoryRuns().find(run => run.runId === runId) ?? null
      : getLatestReconciliationRunPointer(mode)

  if (!pointer) {
    return { pointer: null, payload: null }
  }

  const summaryPath = pointer.reconciliationSummaryJson
  if (!fileExists(summaryPath)) {
    return { pointer, payload: null }
  }

  const payload = readJsonFile<ReconciliationSummaryPayload | Record<string, unknown>>(summaryPath)
  const runMetadata = readRunMetadata(pointer.runDir)

  return {
    pointer,
    payload: sanitizeReconciliationSummaryPayload(payload, pointer.runId, runMetadata),
  }
}

export function getArtifactHref(runId: string, artifactPath: string): string {
  const params = new URLSearchParams({
    run: runId,
    path: artifactPath,
  })
  return `/api/admin/playwright/artifacts?${params.toString()}`
}

export function resolveRunArtifactPath(runId: string, artifactPath: string): string | null {
  const run = listHistoryRuns().find(entry => entry.runId === runId)
  if (!run) {
    return null
  }

  const resolvedRunDir = normalizeRunDir(run.runDir)
  const resolvedArtifactPath = normalizeRunDir(path.join(resolvedRunDir, artifactPath))
  const relative = path.relative(resolvedRunDir, resolvedArtifactPath)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null
  }

  if (!fileExists(resolvedArtifactPath)) {
    return null
  }

  return resolvedArtifactPath
}

export function splitArtifactPaths(value: string): string[] {
  return value
    .split('|')
    .map(part => part.trim())
    .filter(Boolean)
}
