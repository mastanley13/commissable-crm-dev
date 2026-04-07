import React from 'react'
import Link from 'next/link'
import { getAuthenticatedUser, hasPermission } from '@/lib/auth'
import {
  getArtifactHref,
  getLatestReconciliationRunPointer,
  listRecentReconciliationRuns,
  readReconciliationRunSummary,
  resolveRunArtifactPath,
  splitArtifactPaths,
  type ReconciliationScenarioRow,
} from '@/lib/playwright-reconciliation-results'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SearchParams = {
  run?: string | string[]
  compare?: string | string[]
  status?: string | string[]
  lane?: string | string[]
  q?: string | string[]
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unknown'

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatCoverage(recorded: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((recorded / total) * 100)}%`
}

function statusClasses(status: string): string {
  switch (status) {
    case 'pass':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'pass-pending-ui-review':
      return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'blocked':
      return 'bg-slate-100 text-slate-700 border border-slate-200'
    case 'fail':
      return 'bg-rose-50 text-rose-700 border border-rose-200'
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200'
  }
}

function laneClasses(lane: string): string {
  switch (lane) {
    case 'deterministic':
      return 'bg-blue-50 text-blue-700 border border-blue-200'
    case 'ui-review':
      return 'bg-violet-50 text-violet-700 border border-violet-200'
    case 'needs-clarification':
      return 'bg-orange-50 text-orange-700 border border-orange-200'
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200'
  }
}

function relativeStatusTone(value: 'new' | 'changed' | 'same'): string {
  switch (value) {
    case 'new':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'changed':
      return 'bg-amber-50 text-amber-700 border border-amber-200'
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200'
  }
}

function runTypeClasses(run: { isFullSuiteRun: boolean }, isLatestFullRun: boolean): string {
  if (run.isFullSuiteRun) {
    return isLatestFullRun ? 'bg-emerald-50 text-emerald-700' : 'bg-teal-50 text-teal-700'
  }

  return 'bg-amber-50 text-amber-700'
}

function filterRows(
  rows: ReconciliationScenarioRow[],
  filters: { status: string; lane: string; q: string }
) {
  const q = filters.q.trim().toLowerCase()

  return rows.filter(row => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.lane && row.lane !== filters.lane) return false
    if (!q) return true

    const haystack = [
      row.scenarioId,
      row.title,
      row.group,
      row.lane,
      row.status,
      row.reason,
      row.notes,
      row.executionMode,
      row.flowId,
      row.depositId,
      row.lineId,
      row.scheduleIds,
      row.artifactPaths,
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(q)
  })
}

function rowsDiffer(current: ReconciliationScenarioRow, baseline: ReconciliationScenarioRow): boolean {
  return (
    baseline.status !== current.status ||
    baseline.lane !== current.lane ||
    baseline.reason !== current.reason ||
    baseline.notes !== current.notes ||
    baseline.executionMode !== current.executionMode ||
    baseline.flowId !== current.flowId ||
    baseline.depositId !== current.depositId ||
    baseline.lineId !== current.lineId ||
    baseline.scheduleIds !== current.scheduleIds ||
    baseline.artifactPaths !== current.artifactPaths
  )
}

function buildRunHref(runId: string, status: string, lane: string, q: string, compare: string) {
  const params = new URLSearchParams()
  params.set('run', runId)
  if (compare) params.set('compare', compare)
  if (status) params.set('status', status)
  if (lane) params.set('lane', lane)
  if (q) params.set('q', q)
  return `/admin/playwright?${params.toString()}`
}

function buildCompareHref(runId: string, compare: string, status: string, lane: string, q: string) {
  const params = new URLSearchParams()
  params.set('run', runId)
  if (compare) params.set('compare', compare)
  if (status) params.set('status', status)
  if (lane) params.set('lane', lane)
  if (q) params.set('q', q)
  return `/admin/playwright?${params.toString()}`
}

function isImageArtifact(artifactPath: string): boolean {
  return /\.(png|jpg|jpeg)$/i.test(artifactPath)
}

function isVideoArtifact(artifactPath: string): boolean {
  return /\.webm$/i.test(artifactPath)
}

function buildComparison(
  currentRows: ReconciliationScenarioRow[],
  compareRows: ReconciliationScenarioRow[]
) {
  type ComparisonState = {
    baseline: ReconciliationScenarioRow | null
    state: 'new' | 'changed' | 'same'
  }

  const compareMap = new Map(compareRows.map(row => [row.scenarioId, row]))

  let changed = 0
  let unchanged = 0
  let newInCurrent = 0

  const perScenario = new Map<string, ComparisonState>(
    currentRows.map(row => {
      const baseline = compareMap.get(row.scenarioId)
      if (!baseline) {
        newInCurrent += 1
        return [row.scenarioId, { baseline: null, state: 'new' as const }]
      }

      if (rowsDiffer(row, baseline)) {
        changed += 1
        return [row.scenarioId, { baseline, state: 'changed' as const }]
      }

      unchanged += 1
      return [row.scenarioId, { baseline, state: 'same' as const }]
    })
  )

  return {
    changed,
    unchanged,
    newInCurrent,
    perScenario,
  }
}

export default async function AdminPlaywrightPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const user = await getAuthenticatedUser()
  const canViewPlaywrightResults = Boolean(
    user && hasPermission(user, 'admin.playwright.read')
  )

  if (!canViewPlaywrightResults) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-5">
            <h1 className="text-2xl font-bold text-gray-900">Playwright Results</h1>
            <p className="mt-2 max-w-2xl text-sm text-red-700">
              Access denied. You need the <code className="rounded bg-red-100 px-1 py-0.5">admin.playwright.read</code> permission to view Playwright QA artifacts.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const selectedRunId = firstParam(searchParams?.run)
  const selectedCompareRunId = firstParam(searchParams?.compare)
  const selectedStatus = firstParam(searchParams?.status)
  const selectedLane = firstParam(searchParams?.lane)
  const query = firstParam(searchParams?.q)

  const { pointer, payload } = readReconciliationRunSummary(selectedRunId || undefined, 'full')
  const latestFull = getLatestReconciliationRunPointer('full')
  const latestPartial = getLatestReconciliationRunPointer('partial')
  const recentRuns = listRecentReconciliationRuns(12)
  const recentFullRuns = recentRuns.filter(run => run.isFullSuiteRun)
  const recentPartialRuns = recentRuns.filter(run => !run.isFullSuiteRun)
  const compareSummary =
    selectedCompareRunId && selectedCompareRunId !== pointer?.runId
      ? readReconciliationRunSummary(selectedCompareRunId)
      : null

  if (!pointer || !payload) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Playwright Results</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              No reconciliation-suite summary is available yet. Run <code className="rounded bg-gray-100 px-1 py-0.5">npm run pw:recon:test</code> first.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const filteredRows = filterRows(payload.rows, {
    status: selectedStatus,
    lane: selectedLane,
    q: query,
  })
  const totalScenarios = payload.summary.total
  const notRecordedCount = payload.summary.statusCounts['not-recorded'] ?? 0
  const recordedCount = Math.max(totalScenarios - notRecordedCount, 0)
  const coverage = formatCoverage(recordedCount, totalScenarios)
  const isLatestFullView = latestFull?.runId === pointer.runId

  const comparison =
    compareSummary?.pointer && compareSummary.payload
      ? buildComparison(payload.rows, compareSummary.payload.rows)
      : null

  const artifactLinks = [
    ['Summary (Markdown)', getArtifactHref(pointer.runId, 'reconciliation-summary.md')],
    ['Summary (JSON)', getArtifactHref(pointer.runId, 'reconciliation-summary.json')],
    ['Scenario CSV', getArtifactHref(pointer.runId, 'reconciliation-scenarios.csv')],
    ['Results JSON', getArtifactHref(pointer.runId, 'results.json')],
    ['JUnit XML', getArtifactHref(pointer.runId, 'results.xml')],
  ]

  return (
    <div className="h-full overflow-auto">
      <div className="p-6">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              Playwright QA
            </div>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">Reconciliation Results</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Review reconciliation-suite Playwright outcomes, compare runs, preview saved evidence, and open exported summaries without leaving the app.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm lg:w-[420px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900">Active run</span>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${pointer.isFullSuiteRun ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {pointer.isFullSuiteRun
                  ? isLatestFullView
                    ? 'Latest full run'
                    : 'Full run'
                  : 'Partial run'}
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <p><span className="font-medium text-gray-900">Run ID:</span> {pointer.runId}</p>
              <p><span className="font-medium text-gray-900">Finished:</span> {formatDate(payload.runMetadata?.finishedAt)}</p>
              <p><span className="font-medium text-gray-900">Coverage:</span> {recordedCount} of {totalScenarios} scenarios recorded ({coverage})</p>
              <p><span className="font-medium text-gray-900">Fixture version:</span> {payload.runMetadata?.fixtureVersion ?? 'Unknown'}</p>
              <p><span className="font-medium text-gray-900">Environment:</span> {payload.runMetadata?.environmentLabel ?? 'Unknown'}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {artifactLinks.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  {label}
                </a>
              ))}
              {latestFull && latestFull.runId !== pointer.runId ? (
                <Link
                  href={buildRunHref(latestFull.runId, selectedStatus, selectedLane, query, selectedCompareRunId)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Open latest full run
                </Link>
              ) : null}
              {latestPartial && !latestPartial.isFullSuiteRun && latestPartial.runId !== pointer.runId ? (
                <Link
                  href={buildRunHref(latestPartial.runId, selectedStatus, selectedLane, query, selectedCompareRunId)}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                >
                  Open latest partial run
                </Link>
              ) : null}
            </div>
            {pointer.isFullSuiteRun ? (
              isLatestFullView ? (
                <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  This is the latest full run. Use it as the sprint progress snapshot.
                </p>
              ) : latestFull ? (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  You are viewing a historical full run. The latest full sprint snapshot is {latestFull.runId}.
                </p>
              ) : null
            ) : (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Partial runs are for targeted checks. This run recorded {recordedCount} of {totalScenarios} scenarios, so use the latest full run for sprint reporting.
              </p>
            )}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {[
            ['Sprint total', totalScenarios, 'text-gray-900', 'Full manifest'],
            ['Recorded in run', recordedCount, 'text-sky-700', `${coverage} coverage`],
            ['Not recorded', notRecordedCount, 'text-gray-700', pointer.isFullSuiteRun ? 'Should stay at 0 for full runs' : 'Not executed in this run'],
            ['Pass', payload.summary.statusCounts.pass ?? 0, 'text-emerald-700', 'Fully proven'],
            ['Pending UI review', payload.summary.statusCounts['pass-pending-ui-review'] ?? 0, 'text-amber-700', 'Needs human confirmation'],
            ['Blocked', payload.summary.statusCounts.blocked ?? 0, 'text-slate-700', 'Fixture or scope issue'],
            ['Fail', payload.summary.statusCounts.fail ?? 0, 'text-rose-700', 'Automation hit a defect'],
          ].map(([label, value, color, hint]) => (
            <div key={String(label)} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">{label}</p>
              <p className={`mt-2 text-2xl font-bold ${String(color)}`}>{value}</p>
              <p className="mt-1 text-xs text-gray-500">{hint}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[2fr,1fr]">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
              <Link
                href={`/admin/playwright${selectedRunId ? `?run=${encodeURIComponent(selectedRunId)}` : ''}${selectedCompareRunId ? `${selectedRunId ? '&' : '?'}compare=${encodeURIComponent(selectedCompareRunId)}` : ''}`}
                className="text-sm font-semibold text-sky-700 hover:underline"
              >
                Clear filters
              </Link>
            </div>
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <input type="hidden" name="run" value={selectedRunId || pointer.runId} />
              <label className="text-sm text-gray-700">
                <span className="mb-1 block font-medium">Compare to run</span>
                <select
                  name="compare"
                  defaultValue={selectedCompareRunId}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500"
                >
                  <option value="">No comparison</option>
                  {recentRuns
                    .filter(run => run.runId !== (selectedRunId || pointer.runId))
                    .map(run => (
                      <option key={run.runId} value={run.runId}>
                        {run.runId} {run.isFullSuiteRun ? '(full)' : '(partial)'}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block font-medium">Search</span>
              <input
                  name="q"
                  defaultValue={query}
                  placeholder="RS-068, TC-04, deposit id, flow id, blocked..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-sky-500"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block font-medium">Status</span>
                <select
                  name="status"
                  defaultValue={selectedStatus}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500"
                >
                  <option value="">All statuses</option>
                  <option value="pass">Pass</option>
                  <option value="pass-pending-ui-review">Pass-pending-ui-review</option>
                  <option value="blocked">Blocked</option>
                  <option value="fail">Fail</option>
                  <option value="not-recorded">Not recorded</option>
                </select>
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block font-medium">Lane</span>
                <select
                  name="lane"
                  defaultValue={selectedLane}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500"
                >
                  <option value="">All lanes</option>
                  <option value="deterministic">Deterministic</option>
                  <option value="ui-review">UI review</option>
                  <option value="needs-clarification">Needs clarification</option>
                  <option value="known-bug">Known bug</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  Apply filters
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Run browser</h2>
            <p className="mt-1 text-sm text-gray-500">
              Full runs are reporting snapshots. Partial runs are targeted checks and should not drive sprint status.
            </p>

            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Full runs</h3>
              <div className="mt-3 space-y-2">
                {recentFullRuns.map(run => {
                  const runTotal = run.scenarioCount ?? 0
                  const runNotRecorded = run.statusCounts['not-recorded'] ?? 0
                  const runRecorded = Math.max(runTotal - runNotRecorded, 0)
                  const runCoverage = formatCoverage(runRecorded, runTotal)
                  const isLatestFullRun = latestFull?.runId === run.runId
                  const isSelectedCompare = selectedCompareRunId === run.runId

                  return (
                    <div
                      key={run.runId}
                      className={`rounded-lg border px-3 py-3 ${
                        run.runId === pointer.runId
                          ? 'border-sky-300 bg-sky-50'
                          : isSelectedCompare
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{run.runId}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${runTypeClasses(run, isLatestFullRun)}`}>
                              {isLatestFullRun ? 'Latest full' : 'Full'}
                            </span>
                            {run.runId === pointer.runId ? (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                Viewing
                              </span>
                            ) : null}
                            {isSelectedCompare ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                Comparing
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Finished {formatDate(run.generatedAt)}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Link
                            href={buildRunHref(run.runId, selectedStatus, selectedLane, query, selectedCompareRunId)}
                            className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                          >
                            View
                          </Link>
                          {run.runId !== pointer.runId ? (
                            <Link
                              href={buildCompareHref(pointer.runId, run.runId, selectedStatus, selectedLane, query)}
                              className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                            >
                              Compare
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Pass {run.statusCounts.pass ?? 0} | Pending {run.statusCounts['pass-pending-ui-review'] ?? 0} | Blocked {run.statusCounts.blocked ?? 0} | Fail {run.statusCounts.fail ?? 0}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Coverage {runRecorded}/{runTotal} ({runCoverage})
                      </div>
                    </div>
                  )
                })}
                {recentFullRuns.length === 0 ? (
                  <p className="text-sm text-gray-500">No full runs found yet.</p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 border-t border-gray-200 pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Partial runs</h3>
              <div className="mt-3 space-y-2">
                {recentPartialRuns.map(run => {
                  const runTotal = run.scenarioCount ?? 0
                  const runNotRecorded = run.statusCounts['not-recorded'] ?? 0
                  const runRecorded = Math.max(runTotal - runNotRecorded, 0)
                  const runCoverage = formatCoverage(runRecorded, runTotal)
                  const isSelectedCompare = selectedCompareRunId === run.runId

                  return (
                    <div
                      key={run.runId}
                      className={`rounded-lg border px-3 py-3 ${
                        run.runId === pointer.runId
                          ? 'border-sky-300 bg-sky-50'
                          : isSelectedCompare
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{run.runId}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${runTypeClasses(run, false)}`}>
                              Partial
                            </span>
                            {run.runId === pointer.runId ? (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                Viewing
                              </span>
                            ) : null}
                            {isSelectedCompare ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                Comparing
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Finished {formatDate(run.generatedAt)}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Link
                            href={buildRunHref(run.runId, selectedStatus, selectedLane, query, selectedCompareRunId)}
                            className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                          >
                            View
                          </Link>
                          {run.runId !== pointer.runId ? (
                            <Link
                              href={buildCompareHref(pointer.runId, run.runId, selectedStatus, selectedLane, query)}
                              className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                            >
                              Compare
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Pass {run.statusCounts.pass ?? 0} | Pending {run.statusCounts['pass-pending-ui-review'] ?? 0} | Blocked {run.statusCounts.blocked ?? 0} | Fail {run.statusCounts.fail ?? 0} | Not recorded {runNotRecorded}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Coverage {runRecorded}/{runTotal} ({runCoverage})
                      </div>
                    </div>
                  )
                })}
                {recentPartialRuns.length === 0 ? (
                  <p className="text-sm text-gray-500">No partial runs found.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {compareSummary?.pointer && compareSummary.payload && comparison ? (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Run comparison</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Comparing {pointer.runId} against {compareSummary.pointer.runId}.
                </p>
              </div>
              <Link
                href={buildCompareHref(pointer.runId, '', selectedStatus, selectedLane, query)}
                className="text-sm font-semibold text-sky-700 hover:underline"
              >
                Clear comparison
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                ['Changed rows', comparison.changed, 'text-amber-700'],
                ['Unchanged rows', comparison.unchanged, 'text-gray-900'],
                ['New in current view', comparison.newInCurrent, 'text-emerald-700'],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">{label}</div>
                  <div className={`mt-2 text-2xl font-bold ${String(color)}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Ready for review</h2>
            <div className="mt-4 space-y-3">
              {[...payload.summary.passes, ...payload.summary.pendingUiReview].slice(0, 8).map(row => (
                <div key={row.scenarioId} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses(row.status)}`}>
                      {row.status}
                    </span>
                    <span className="font-semibold text-gray-900">{row.scenarioId}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{row.title}</p>
                </div>
              ))}
              {payload.summary.passes.length + payload.summary.pendingUiReview.length === 0 ? (
                <p className="text-sm text-gray-500">No scenarios are currently marked ready for review.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Top blocked reasons</h2>
            <div className="mt-4 space-y-3">
              {payload.summary.blockedReasons.slice(0, 5).map(reason => (
                <div key={reason.reason} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                  <div className="text-sm font-semibold text-gray-900">{reason.count} scenario(s)</div>
                  <p className="mt-1 text-sm text-gray-600">{reason.reason}</p>
                </div>
              ))}
              {payload.summary.blockedReasons.length === 0 ? (
                <p className="text-sm text-gray-500">No blocked reasons were recorded for this run.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Scenario rows</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Showing {filteredRows.length} of {payload.rows.length} scenarios for run {pointer.runId}. Recorded {recordedCount}, not recorded {notRecordedCount}.
                </p>
              </div>
              <div className="text-xs text-gray-500">
                HTML report command: <code className="rounded bg-gray-100 px-1 py-0.5">npm run pw:recon:report</code>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Scenario',
                    'Group',
                    'Lane',
                    'Status',
                    ...(comparison ? ['Compared'] : []),
                    'Reason',
                    'Flow',
                    'Artifacts',
                  ].map(header => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredRows.map(row => {
                  const artifacts = splitArtifactPaths(row.artifactPaths).filter(artifactPath =>
                    resolveRunArtifactPath(pointer.runId, artifactPath)
                  )
                  const firstArtifact = artifacts[0]
                  const firstImageArtifact = artifacts.find(isImageArtifact)
                  const firstVideoArtifact = artifacts.find(isVideoArtifact)
                  const compareState = comparison?.perScenario.get(row.scenarioId)

                  return (
                    <tr key={row.scenarioId} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-gray-900">{row.scenarioId}</div>
                        <div className="mt-1 text-sm text-gray-600">{row.title}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{row.group}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${laneClasses(row.lane)}`}>
                          {row.lane}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      {comparison ? (
                        <td className="px-4 py-4 text-sm">
                          {compareState ? (
                            <div className="space-y-2">
                              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${relativeStatusTone(compareState.state)}`}>
                                {compareState.state}
                              </span>
                              {compareState.baseline ? (
                                <div className="text-xs text-gray-500">
                                  Baseline: {compareState.baseline.status}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-gray-400">No comparison</span>
                          )}
                        </td>
                      ) : null}
                      <td className="max-w-[420px] px-4 py-4 text-sm text-gray-600">
                        {row.reason ? (
                          <details>
                            <summary className="cursor-pointer font-medium text-gray-700">View reason</summary>
                            <p className="mt-2 whitespace-pre-wrap">{row.reason}</p>
                          </details>
                        ) : (
                          <span className="text-gray-400">No reason recorded</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {row.flowId ? (
                          <div>
                            <div className="font-medium text-gray-800">{row.flowId}</div>
                            {row.depositId ? <div className="mt-1 text-xs text-gray-500">Deposit {row.depositId}</div> : null}
                          </div>
                        ) : (
                          <span className="text-gray-400">No live flow</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {firstArtifact ? (
                          <div className="space-y-3">
                            <div className="flex flex-col gap-2">
                              <a
                                href={getArtifactHref(pointer.runId, firstArtifact)}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-sky-700 hover:underline"
                              >
                                Open artifact
                              </a>
                              {artifacts.length > 1 ? (
                                <span className="text-xs text-gray-500">
                                  {artifacts.length} artifacts recorded
                                </span>
                              ) : null}
                            </div>
                            {firstImageArtifact ? (
                              <a
                                href={getArtifactHref(pointer.runId, firstImageArtifact)}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                              >
                                <img
                                  src={getArtifactHref(pointer.runId, firstImageArtifact)}
                                  alt={`${row.scenarioId} artifact preview`}
                                  className="h-28 w-full object-cover object-top"
                                />
                              </a>
                            ) : null}
                            {!firstImageArtifact && firstVideoArtifact ? (
                              <video
                                controls
                                preload="metadata"
                                className="w-full rounded-lg border border-gray-200 bg-black"
                              >
                                <source
                                  src={getArtifactHref(pointer.runId, firstVideoArtifact)}
                                  type="video/webm"
                                />
                              </video>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-gray-400">No artifact</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
