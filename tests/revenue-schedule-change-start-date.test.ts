import test from "node:test"
import assert from "node:assert/strict"

import {
  buildChangeStartDatePreview,
  canSubmitChangeStartDate,
  type ChangeStartDateScheduleInput,
} from "../lib/revenue-schedule-change-start-date"

function makeSchedule(overrides: Partial<ChangeStartDateScheduleInput> = {}): ChangeStartDateScheduleInput {
  return {
    id: overrides.id ?? "schedule-1",
    scheduleNumber: overrides.scheduleNumber ?? "RS-1",
    scheduleDate: overrides.scheduleDate ?? new Date("2026-01-01T00:00:00.000Z"),
    opportunityProductId: overrides.opportunityProductId ?? "opp-product-1",
    productNameVendor: overrides.productNameVendor ?? "Hosted Voice",
    distributorName: overrides.distributorName ?? "Distributor",
    vendorName: overrides.vendorName ?? "Vendor",
    opportunityName: overrides.opportunityName ?? "Opportunity",
    actualUsage: overrides.actualUsage ?? 0,
    actualCommission: overrides.actualCommission ?? 0,
    scheduleStatus: overrides.scheduleStatus ?? "Unreconciled",
    billingStatus: overrides.billingStatus ?? "Open",
  }
}

test("buildChangeStartDatePreview computes the February shift from the earliest selected row", async () => {
  const preview = await buildChangeStartDatePreview({
    selectedSchedules: [
      makeSchedule({
        id: "rs-1",
        scheduleNumber: "RS-100",
        scheduleDate: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeSchedule({
        id: "rs-2",
        scheduleNumber: "RS-101",
        scheduleDate: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ],
    newStartDateText: "2026-02-01",
    requireReason: false,
    loadExistingSchedulesForDates: async () => [],
  })

  assert.equal(preview.canApply, true)
  assert.equal(preview.baselineDate, "2026-01-01")
  assert.equal(preview.newStartDate, "2026-02-01")
  assert.equal(preview.deltaMonths, 1)
  assert.deepEqual(
    preview.rows.map(row => ({ scheduleNumber: row.scheduleNumber, newDate: row.newDate })),
    [
      { scheduleNumber: "RS-100", newDate: "2026-02-01" },
      { scheduleNumber: "RS-101", newDate: "2026-06-01" },
    ],
  )
})

test("buildChangeStartDatePreview marks duplicate selected dates as collisions", async () => {
  const preview = await buildChangeStartDatePreview({
    selectedSchedules: [
      makeSchedule({
        id: "rs-1",
        scheduleNumber: "RS-200",
        scheduleDate: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeSchedule({
        id: "rs-2",
        scheduleNumber: "RS-201",
        scheduleDate: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ],
    newStartDateText: "2026-02-01",
    requireReason: false,
    loadExistingSchedulesForDates: async () => [],
  })

  assert.equal(preview.canApply, false)
  assert.equal(preview.rows.every(row => row.status === "collision"), true)
  assert.equal(preview.conflictSummaries.some(summary => /2026-02-01/.test(summary)), true)
  assert.equal(preview.conflictSummaries.some(summary => /RS-200|RS-201/.test(summary)), true)
  assert.equal(preview.conflictSummaries.some(summary => /rs-1|rs-2/.test(summary)), false)
})

test("buildChangeStartDatePreview reports external collisions with schedule numbers", async () => {
  const preview = await buildChangeStartDatePreview({
    selectedSchedules: [
      makeSchedule({
        id: "rs-1",
        scheduleNumber: "RS-300",
        scheduleDate: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ],
    newStartDateText: "2026-02-01",
    requireReason: false,
    loadExistingSchedulesForDates: async () => [
      {
        id: "existing-1",
        scheduleNumber: "RS-999",
        scheduleDate: new Date("2026-02-01T00:00:00.000Z"),
      },
    ],
  })

  assert.equal(preview.canApply, false)
  assert.equal(preview.rows[0]?.status, "collision")
  assert.match(preview.conflictSummaries[0] ?? "", /RS-999/)
  assert.equal(preview.conflictSummaries[0]?.includes("existing-1"), false)
})

test("canSubmitChangeStartDate only allows submit when preview is ready and resolved", () => {
  assert.equal(
    canSubmitChangeStartDate({
      selectedCount: 1,
      hasNewStartDate: true,
      reason: "Customer requested correction",
      preview: { canApply: false },
      previewLoading: false,
      previewError: null,
    }),
    false,
  )

  assert.equal(
    canSubmitChangeStartDate({
      selectedCount: 1,
      hasNewStartDate: true,
      reason: "Customer requested correction",
      preview: { canApply: true },
      previewLoading: false,
      previewError: null,
    }),
    true,
  )
})

test("buildChangeStartDatePreview blocks matched, finalized, and disputed schedules", async () => {
  const preview = await buildChangeStartDatePreview({
    selectedSchedules: [
      makeSchedule({
        id: "matched",
        scheduleNumber: "RS-400",
        actualUsage: 10,
      }),
      makeSchedule({
        id: "finalized",
        scheduleNumber: "RS-401",
        billingStatus: "Reconciled",
      }),
      makeSchedule({
        id: "disputed",
        scheduleNumber: "RS-402",
        billingStatus: "InDispute",
      }),
    ],
    newStartDateText: "2026-02-01",
    requireReason: true,
    reason: "",
    loadExistingSchedulesForDates: async () => [],
  })

  assert.equal(preview.canApply, false)
  assert.equal(preview.blockingReasons.some(reason => reason.includes("already matched")), true)
  assert.equal(preview.blockingReasons.some(reason => reason.includes("finalized")), true)
  assert.equal(preview.blockingReasons.some(reason => reason.includes("in dispute")), true)
  assert.equal(preview.blockingReasons.some(reason => reason.includes("Enter a reason")), true)
})
