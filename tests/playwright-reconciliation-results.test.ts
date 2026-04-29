import test from "node:test"
import assert from "node:assert/strict"

import {
  getAllowedArtifactContentType,
  getMostSuccessfulReconciliationRunPointer,
  sanitizeReconciliationSummaryPayload,
  sanitizeRunMetadata,
} from "@/lib/playwright-reconciliation-results"

test("getAllowedArtifactContentType allows only the approved artifact extensions", () => {
  assert.equal(getAllowedArtifactContentType("evidence.png"), "image/png")
  assert.equal(getAllowedArtifactContentType("results.webm"), "video/webm")
  assert.equal(getAllowedArtifactContentType("summary.json"), "application/json; charset=utf-8")
  assert.equal(getAllowedArtifactContentType("report.html"), null)
  assert.equal(getAllowedArtifactContentType("archive.zip"), null)
})

test("getMostSuccessfulReconciliationRunPointer selects the strongest full-suite run", () => {
  const pointer = getMostSuccessfulReconciliationRunPointer("full")

  assert.equal(pointer?.runId, "2026-04-22_full-reconciliation-recorded_14-27-40")
  assert.equal(pointer?.statusCounts.pass, 56)
  assert.equal(pointer?.statusCounts["pass-pending-ui-review"], 49)
})

test("sanitizeRunMetadata redacts internal filesystem and auth details", () => {
  const sanitized = sanitizeRunMetadata({
    runId: "2026-04-06_10-00-00",
    runDir: "C:/secret/.artifacts/playwright/reconciliation-suite/history/2026-04-06_10-00-00",
    suiteName: "reconciliation-suite",
    startedAt: "2026-04-06T14:00:00.000Z",
    finishedAt: "2026-04-06T14:05:00.000Z",
    exitCode: 0,
    baseURL: "http://127.0.0.1:3000",
    authFile: "C:/secret/.artifacts/playwright/auth/user.json",
    environmentLabel: "local",
    fixtureVersion: "fixture-v1",
    scenarioManifestPath: "docs/plans/scenario-manifest.json",
    scenarioManifestGeneratedAt: "2026-04-06T13:55:00.000Z",
    scenarioCount: 12,
    isFullSuiteRun: true,
    gitCommit: "abcdef123456",
    statusCounts: { pass: 12 },
    artifactPaths: {
      htmlDir: "C:/secret/html",
    },
  })

  assert.deepEqual(sanitized, {
    runId: "2026-04-06_10-00-00",
    suiteName: "reconciliation-suite",
    startedAt: "2026-04-06T14:00:00.000Z",
    finishedAt: "2026-04-06T14:05:00.000Z",
    exitCode: 0,
    environmentLabel: "local",
    fixtureVersion: "fixture-v1",
    scenarioManifestGeneratedAt: "2026-04-06T13:55:00.000Z",
    scenarioCount: 12,
    isFullSuiteRun: true,
    statusCounts: { pass: 12 },
  })
})

test("sanitizeReconciliationSummaryPayload backfills a safe runId and metadata shape", () => {
  const payload = sanitizeReconciliationSummaryPayload(
    {
      runDir: "C:/secret/.artifacts/playwright/reconciliation-suite/history/2026-04-06_10-00-00",
      summary: {
        total: 1,
        statusCounts: { pass: 1 },
        laneCounts: { deterministic: 1 },
        passes: [],
        pendingUiReview: [],
        failures: [],
        blocked: [],
        notRecorded: [],
        failureReasons: [],
        blockedReasons: [],
      },
      rows: [],
    },
    "2026-04-06_10-00-00",
    {
      runId: "2026-04-06_10-00-00",
      runDir: "C:/secret/.artifacts/playwright/reconciliation-suite/history/2026-04-06_10-00-00",
      suiteName: "reconciliation-suite",
      startedAt: "2026-04-06T14:00:00.000Z",
      finishedAt: "2026-04-06T14:05:00.000Z",
      exitCode: 0,
      baseURL: "http://127.0.0.1:3000",
      authFile: "C:/secret/.artifacts/playwright/auth/user.json",
      environmentLabel: "local",
      fixtureVersion: "fixture-v1",
      scenarioManifestPath: "docs/plans/scenario-manifest.json",
      scenarioManifestGeneratedAt: "2026-04-06T13:55:00.000Z",
      scenarioCount: 12,
      isFullSuiteRun: true,
      gitCommit: "abcdef123456",
      statusCounts: { pass: 12 },
      artifactPaths: {},
    }
  )

  assert.equal(payload.runId, "2026-04-06_10-00-00")
  assert.deepEqual(payload.runMetadata, {
    runId: "2026-04-06_10-00-00",
    suiteName: "reconciliation-suite",
    startedAt: "2026-04-06T14:00:00.000Z",
    finishedAt: "2026-04-06T14:05:00.000Z",
    exitCode: 0,
    environmentLabel: "local",
    fixtureVersion: "fixture-v1",
    scenarioManifestGeneratedAt: "2026-04-06T13:55:00.000Z",
    scenarioCount: 12,
    isFullSuiteRun: true,
    statusCounts: { pass: 12 },
  })
})
