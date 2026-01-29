import test from "node:test"
import assert from "node:assert/strict"

import {
  RevenueScheduleBillingStatus,
  RevenueScheduleBillingStatusSource,
  RevenueScheduleFlexClassification,
  RevenueScheduleStatus,
} from "@prisma/client"
import { computeNextBillingStatus } from "../lib/reconciliation/billing-status"

test("computeNextBillingStatus: flex schedules are always In Dispute", () => {
  const result = computeNextBillingStatus({
    currentBillingStatus: RevenueScheduleBillingStatus.Open,
    billingStatusSource: RevenueScheduleBillingStatusSource.Auto,
    scheduleStatus: RevenueScheduleStatus.Reconciled,
    flexClassification: RevenueScheduleFlexClassification.FlexProduct,
    hasAppliedMatches: true,
    hasUnreconciledAppliedMatches: false,
  })

  assert.equal(result, RevenueScheduleBillingStatus.InDispute)
})

test("computeNextBillingStatus: In Dispute is sticky for non-flex schedules (phase 1)", () => {
  const result = computeNextBillingStatus({
    currentBillingStatus: RevenueScheduleBillingStatus.InDispute,
    billingStatusSource: RevenueScheduleBillingStatusSource.Auto,
    scheduleStatus: RevenueScheduleStatus.Reconciled,
    flexClassification: RevenueScheduleFlexClassification.Normal,
    hasAppliedMatches: true,
    hasUnreconciledAppliedMatches: false,
  })

  assert.equal(result, RevenueScheduleBillingStatus.InDispute)
})

test("computeNextBillingStatus: STRICT Reconciled requires finalized/applied matches", () => {
  const reconciled = computeNextBillingStatus({
    currentBillingStatus: RevenueScheduleBillingStatus.Open,
    billingStatusSource: RevenueScheduleBillingStatusSource.Auto,
    scheduleStatus: RevenueScheduleStatus.Reconciled,
    flexClassification: RevenueScheduleFlexClassification.Normal,
    hasAppliedMatches: true,
    hasUnreconciledAppliedMatches: false,
  })
  assert.equal(reconciled, RevenueScheduleBillingStatus.Reconciled)

  const notFinalizedYet = computeNextBillingStatus({
    currentBillingStatus: RevenueScheduleBillingStatus.Open,
    billingStatusSource: RevenueScheduleBillingStatusSource.Auto,
    scheduleStatus: RevenueScheduleStatus.Reconciled,
    flexClassification: RevenueScheduleFlexClassification.Normal,
    hasAppliedMatches: true,
    hasUnreconciledAppliedMatches: true,
  })
  assert.equal(notFinalizedYet, RevenueScheduleBillingStatus.Open)
})

test("computeNextBillingStatus: returns Open when schedule is not settled", () => {
  const result = computeNextBillingStatus({
    currentBillingStatus: RevenueScheduleBillingStatus.Reconciled,
    billingStatusSource: RevenueScheduleBillingStatusSource.Auto,
    scheduleStatus: RevenueScheduleStatus.Overpaid,
    flexClassification: RevenueScheduleFlexClassification.Normal,
    hasAppliedMatches: true,
    hasUnreconciledAppliedMatches: false,
  })

  assert.equal(result, RevenueScheduleBillingStatus.Open)
})
