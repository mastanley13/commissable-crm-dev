import React from 'react'
import Link from 'next/link'
import { getAuthenticatedUser, hasPermission } from '@/lib/auth'
import {
  getArtifactHref,
  getLatestReconciliationRunPointer,
  getMostSuccessfulReconciliationRunPointer,
  readReconciliationRunSummary,
  type ReconciliationReasonCount,
  type ReconciliationScenarioRow,
} from '@/lib/playwright-reconciliation-results'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SearchParams = {
  run?: string | string[]
}

type MetricCardProps = {
  label: string
  value: number
  hint: string
  valueClassName: string
}

type ScenarioSectionProps = {
  title: string
  count: number
  subtitle: string
  badgeClassName: string
  rows: ReconciliationScenarioRow[]
  emptyMessage: string
  variant?: 'default' | 'issue'
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

function statusClasses(status: string): string {
  switch (status) {
    case 'pass':
      return 'border border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'pass-pending-ui-review':
      return 'border border-amber-200 bg-amber-50 text-amber-700'
    case 'blocked':
      return 'border border-slate-200 bg-slate-100 text-slate-700'
    case 'fail':
      return 'border border-rose-200 bg-rose-50 text-rose-700'
    default:
      return 'border border-gray-200 bg-gray-100 text-gray-700'
  }
}

function laneClasses(lane: string): string {
  switch (lane) {
    case 'deterministic':
      return 'border border-blue-200 bg-blue-50 text-blue-700'
    case 'ui-review':
      return 'border border-violet-200 bg-violet-50 text-violet-700'
    case 'needs-clarification':
      return 'border border-orange-200 bg-orange-50 text-orange-700'
    case 'known-bug':
      return 'border border-rose-200 bg-rose-50 text-rose-700'
    default:
      return 'border border-gray-200 bg-gray-100 text-gray-700'
  }
}

function buildResultsHref(runId: string): string {
  return `/admin/playwright?run=${encodeURIComponent(runId)}`
}

function buildMarkdownExportHref(runId: string): string {
  return `${getArtifactHref(runId, 'reconciliation-summary.md')}&download=1`
}

function MetricCard({ label, value, hint, valueClassName }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${valueClassName}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

function ScenarioRow({ row, variant = 'default' }: { row: ReconciliationScenarioRow; variant?: 'default' | 'issue' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses(row.status)}`}>
          {row.status}
        </span>
        <span className="font-semibold text-gray-900">{row.scenarioId}</span>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${laneClasses(row.lane)}`}>
          {row.lane}
        </span>
        <span className="text-xs text-gray-400">{row.group}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-800">{row.title}</p>
      {variant === 'issue' && row.reason ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-sky-700">View reason</summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {row.reason}
          </p>
        </details>
      ) : null}
    </div>
  )
}

function ScenarioSection({
  title,
  count,
  subtitle,
  badgeClassName,
  rows,
  emptyMessage,
  variant = 'default',
}: ScenarioSectionProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName}`}>
          {count}
        </span>
      </div>
      <div className="mt-4 max-h-[540px] space-y-2 overflow-y-auto pr-1">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        ) : (
          rows.map(row => <ScenarioRow key={row.scenarioId} row={row} variant={variant} />)
        )}
      </div>
    </section>
  )
}

function ReasonList({
  reasons,
  emptyMessage,
}: {
  reasons: ReconciliationReasonCount[]
  emptyMessage: string
}) {
  if (reasons.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      {reasons.map(reason => (
        <div key={reason.reason} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">{reason.count} scenario(s)</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{reason.reason}</p>
        </div>
      ))}
    </div>
  )
}

export default async function AdminPlaywrightSummaryPage({
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
            <h1 className="text-2xl font-bold text-gray-900">Playwright Summary</h1>
            <p className="mt-2 max-w-2xl text-sm text-red-700">
              Access denied. You need the <code className="rounded bg-red-100 px-1 py-0.5">admin.playwright.read</code> permission to view Playwright QA artifacts.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const selectedRunId = firstParam(searchParams?.run)
  const mostSuccessfulFull = getMostSuccessfulReconciliationRunPointer('full')
  const defaultRunId = selectedRunId || mostSuccessfulFull?.runId
  const { pointer, payload } = readReconciliationRunSummary(defaultRunId, 'full')
  const latestFull = getLatestReconciliationRunPointer('full')

  if (!pointer || !payload) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-6">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Playwright Summary</h1>
            <p className="mt-2 text-sm text-gray-600">
              No reconciliation-suite summary is available for this run.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const totalScenarios = payload.summary.total
  const notRecordedCount = payload.summary.statusCounts['not-recorded'] ?? 0
  const pendingUiReviewCount = payload.summary.pendingUiReview.length
  const runtimePathValidationCount = payload.summary.runtimePathValidations.length
  const isMostSuccessfulFullView = mostSuccessfulFull?.runId === pointer.runId

  return (
    <div className="h-full overflow-auto bg-slate-50/70">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-sky-50/40 to-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                  Playwright QA
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Run Summary</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Clean stakeholder view for run <span className="font-semibold text-slate-900">{pointer.runId}</span>. This page highlights outcome quality, lane mix, and the follow-up list without sending people into raw markdown.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildResultsHref(pointer.runId)}
                  className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
                >
                  Back to results
                </Link>
                <a
                  href={buildMarkdownExportHref(pointer.runId)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Export markdown
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-slate-900">Active run</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pointer.isFullSuiteRun ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-amber-200 bg-amber-50 text-amber-700'}`}>
                  {pointer.isFullSuiteRun
                    ? isMostSuccessfulFullView
                      ? 'Most successful full run'
                      : 'Historical full run'
                    : 'Partial run'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Run ID</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{pointer.runId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Finished</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{formatDate(payload.runMetadata?.finishedAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Environment</p>
                  <p className="mt-1 text-base font-medium text-slate-800">{payload.runMetadata?.environmentLabel ?? 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Fixture version</p>
                  <p className="mt-1 text-base font-medium text-slate-800">{payload.runMetadata?.fixtureVersion ?? 'Unknown'}</p>
                </div>
              </div>

              {pointer.isFullSuiteRun && !isMostSuccessfulFullView && mostSuccessfulFull ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  You are viewing a historical full run. The strongest available run is <span className="font-semibold">{mostSuccessfulFull.runId}</span>.
                </div>
              ) : null}
              {latestFull && latestFull.runId !== pointer.runId && latestFull.runId !== mostSuccessfulFull?.runId ? (
                <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                  Latest full run: <span className="font-semibold">{latestFull.runId}</span>.
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-5">
              <h2 className="text-base font-semibold text-slate-900">How to read this</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <p><span className="font-semibold text-slate-900">Pass:</span> hard browser proof completed successfully.</p>
                <p><span className="font-semibold text-slate-900">Pending UI review:</span> automation evidence is strong, but a person still needs to confirm the operator-facing outcome.</p>
                <p><span className="font-semibold text-slate-900">Deterministic:</span> the scenario should be machine-provable with stable fixture data and no human judgment step.</p>
                <p><span className="font-semibold text-slate-900">Runtime-path validation:</span> useful harness-path evidence, but not final scenario proof.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-6">
          <MetricCard
            label="Total scenarios"
            value={totalScenarios}
            hint="Full manifest"
            valueClassName="text-slate-950"
          />
          <MetricCard
            label="Pass"
            value={payload.summary.statusCounts.pass ?? 0}
            hint="Fully proven"
            valueClassName="text-emerald-700"
          />
          <MetricCard
            label="Pending UI review"
            value={pendingUiReviewCount}
            hint="Scenario-proof rows"
            valueClassName="text-amber-700"
          />
          <MetricCard
            label="Blocked"
            value={payload.summary.statusCounts.blocked ?? 0}
            hint="Fixture or scope issue"
            valueClassName="text-slate-700"
          />
          <MetricCard
            label="Fail"
            value={payload.summary.statusCounts.fail ?? 0}
            hint="Browser defect or regression"
            valueClassName="text-rose-700"
          />
          <MetricCard
            label="Runtime validations"
            value={runtimePathValidationCount}
            hint="Harness-path checks"
            valueClassName="text-sky-700"
          />
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Lane mix</h2>
              <p className="mt-1 text-sm text-gray-500">
                Lanes describe the kind of proof a scenario is expected to support, not whether the run passed.
              </p>
            </div>
            <div className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">Not recorded:</span> {notRecordedCount}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {[
              ['Deterministic', payload.summary.laneCounts.deterministic ?? 0, 'border-blue-200 bg-blue-50 text-blue-700'],
              ['UI review', payload.summary.laneCounts['ui-review'] ?? 0, 'border-violet-200 bg-violet-50 text-violet-700'],
              ['Needs clarification', payload.summary.laneCounts['needs-clarification'] ?? 0, 'border-orange-200 bg-orange-50 text-orange-700'],
              ['Known bug', payload.summary.laneCounts['known-bug'] ?? 0, 'border-rose-200 bg-rose-50 text-rose-700'],
            ].map(([label, value, classes]) => (
              <div
                key={String(label)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${String(classes)}`}
              >
                {label}: <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Deterministic</span> means the scenario should be machine-provable. <span className="font-semibold text-slate-900">UI review</span> means the evidence is useful, but a human still needs to confirm the final visible outcome.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ScenarioSection
            title="Pass"
            count={payload.summary.statusCounts.pass ?? 0}
            subtitle="Hard browser-proof scenarios that are ready to cite."
            badgeClassName="bg-emerald-50 text-emerald-700"
            rows={payload.summary.passes}
            emptyMessage="No pass scenarios are recorded in this run."
          />
          <ScenarioSection
            title="Pending UI review"
            count={pendingUiReviewCount}
            subtitle="Strong automation evidence that still needs a final operator check."
            badgeClassName="bg-amber-50 text-amber-700"
            rows={payload.summary.pendingUiReview}
            emptyMessage="No pending UI review scenarios are recorded in this run."
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <ScenarioSection
            title="Runtime-path validations"
            count={runtimePathValidationCount}
            subtitle="Harness-path checks that should not be read as final proof."
            badgeClassName="bg-sky-50 text-sky-700"
            rows={payload.summary.runtimePathValidations}
            emptyMessage="No runtime-path validations are recorded in this run."
          />
          <ScenarioSection
            title="Blocked scenarios"
            count={payload.summary.statusCounts.blocked ?? 0}
            subtitle="Cases intentionally held back because fixture setup or workflow truth is not ready."
            badgeClassName="bg-slate-100 text-slate-700"
            rows={payload.summary.blocked}
            emptyMessage="No blocked scenarios were recorded in this run."
            variant="issue"
          />
          <ScenarioSection
            title="Failures"
            count={payload.summary.statusCounts.fail ?? 0}
            subtitle="Real browser assertion or interaction failures."
            badgeClassName="bg-rose-50 text-rose-700"
            rows={payload.summary.failures}
            emptyMessage="No failures were recorded in this run."
            variant="issue"
          />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Top blocked reasons</h2>
          <p className="mt-1 text-sm text-gray-500">
            Aggregated blocker explanations pulled from the saved summary export.
          </p>
          <div className="mt-4">
            <ReasonList
              reasons={payload.summary.blockedReasons}
              emptyMessage="No blocked-reason summary is available for this run."
            />
          </div>
        </div>
      </div>
    </div>
  )
}
