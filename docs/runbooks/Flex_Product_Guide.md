# Flex Product Guide (Usage + Testing Workflow)

Date: 2026-02-19  
Scope: Flex Products created during reconciliation (unknown/unmappable lines and out-of-tolerance overages)

Related references:
- Reconciliation UAT runbook: `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Guide.md` (see **TC-12**)
- M2M continuation runbook: `docs/runbooks/M2M_Schedule_Extension_Guide.md`
- Flex/Chargeback implementation notes: `docs/plans/CRM-FLEX-004-flex-resolution-workflow-review-2026-02-02.md`
- Flex Review Queue verification checklist: `docs/plans/milestone-3-ops-polish-verification.md`

---

## 1) What is a “Flex Product” in this repo?

### 1.1 Canonical definitions (do not mix terms)

- **Flex Product (Exception)**: reconciliation-time placeholder workflow for unknown/unmappable lines or overage outside tolerance.
- **Schedule Extension (M2M)**: month-to-month schedule continuation when products remain billing after planned schedules are exhausted.

This guide covers only **Flex Product (Exception)**.  
For M2M behavior, use: `docs/runbooks/M2M_Schedule_Extension_Guide.md`.

A **Flex Product** is an operational “placeholder” **Product + Revenue Schedule** created during reconciliation when:

1) a deposit line cannot be mapped to a real product/schedule (**unknown / unmappable line**), or  
2) a deposit allocation creates an **overage outside tolerance** and you choose to split that overage into a Flex Product schedule.

In data terms, a Flex Product schedule is a `RevenueSchedule` where:
- `flexClassification = FlexProduct`
- `billingStatus = InDispute` (when billing-status automation is enabled)
- a `FlexReviewItem` is enqueued for management review (queue + notification)

Flex Products are **intentionally reviewable** and designed to keep reconciliation moving without silently “forcing” a catalog decision.

---

## 2) When to use (and when not to use)

### Use Flex Product when
- **Unknown / unmappable product context**: no match exists and you need a placeholder schedule to allocate the line.
- **Overage outside tolerance**: a line is matched to a schedule, but the overage is too large to auto-adjust and you want the overage split into a reviewable placeholder.
- **You want a management review gate**: Flex Products are routed into the Flex Review Queue with notifications.

### Do NOT use Flex Product when
- The overage is **within tolerance**: the system should create an **Adjustment** automatically (“auto_adjust”).
- The schedule is **bonus-like** (Bonus/SPF semantics): the prompt will exclude Flex Product; use **Adjust** or **Manual** instead.
- The line is **negative**: this is handled as a **Chargeback** (`FlexChargeback`) / **CB-REV** (`FlexChargebackReversal`) workflow, not a Flex Product.

---

## 3) Key concepts you’ll see in the UI

### 3.1 Revenue Schedule status vs Billing Status

This repo distinguishes:
- `RevenueSchedule.status` (variance/reconciliation outcome: e.g. `Unreconciled/Overpaid/Reconciled`)
- `RevenueSchedule.billingStatus` (operational lifecycle: `Open/Reconciled/InDispute`)

Important testing note:
- Flex-classified schedules are expected to remain **In Dispute** until an explicit resolution outcome is recorded (usually via the Flex Review Queue).

### 3.2 Flex Review Queue

Creating a Flex Product enqueues a `FlexReviewItem` (status starts as **Open**) and notifies users who have `reconciliation.manage`.

UI location:
- `Reconciliation → Flex Review Queue` (URL: `/reconciliation/flex-review`)

---

## 4) Permissions / roles needed

- Create/resolve Flex items: user must have `reconciliation.manage`.
- Chargeback approvals: `Approve & Apply` requires **ADMIN** (chargebacks are separate from Flex Product, but share the same queue).

If you can’t see actions:
- Confirm your user role has the permission.
- Confirm the line/schedule is not locked (`reconciled`) or excluded (`Ignored`).

---

## 5) Test prerequisites (the two things that commonly block Flex testing)

### Prerequisite A — Revenue schedules exist

Some Flex Product testing depends on selecting a real schedule (overage split + apply-to-existing resolution).

If you have “0 revenue schedules” in UAT, you will be blocked for:
- out-of-tolerance prompt → Flex Product split
- Flex Review “Apply to existing schedule”

Ways to provision minimal schedule data (pick one):
1) Seed data in your environment (example script): `scripts/seed-milestone1-test-data.ts`
2) Use an existing Opportunity that already has schedules

### Prerequisite B — Variance tolerance configured

To reliably trigger the out-of-tolerance prompt, set a small tolerance:
- Go to `/settings` → **Reconciliation Settings**
- Set **Variance Tolerance (tenant default, percent)** (e.g. `1.0%`)

---

## 6) Workflow A — Create Flex Product for an unknown/unmappable deposit line

Goal: allocate a line that has no valid match by creating a Flex Product schedule and matching to it.

### Steps

1. Open a deposit in reconciliation:
   - Navigate to `Reconciliation` and open a deposit detail page (URL: `/reconciliation/<depositId>`).
2. Select a **positive** line item with no good match:
   - Ensure `usage >= 0` and `commission >= 0`.
   - Ensure the line is not `Ignored` and not locked (`reconciled = false`).
3. (Optional) Attach it to a known deal context:
   - Select **exactly one** revenue schedule in the schedules grid (same customer account).
   - This attaches the created Flex Product schedule to that opportunity context.
4. Click **Create Flex Product**.

### Expected results / verification checklist

- Deposit line becomes allocated (typically `Matched`), with unallocated amounts reduced to ~0.
- A new **Flex Product** revenue schedule exists:
  - `flexClassification = FlexProduct`
  - `flexReasonCode = UnknownProduct`
  - `scheduleType = OneTime`
  - `scheduleDate = first day of deposit reporting month` (`YYYY-MM-01`)
  - `expectedUsage/expectedCommission` match the deposit line amounts
  - `billingStatus = InDispute` (when automation is enabled)
- A Flex Review Queue item is created (status **Open**) and a notification appears in `/notifications`.

### Negative tests (should be blocked)

- If the line is already allocated: expect an error like “Unmatch it before creating a flex product.”
- If the line is reconciled/locked: creation should be blocked.
- If you selected a schedule belonging to a different customer account: creation should fail with an attach error.

---

## 7) Workflow B — Out-of-tolerance overage → resolve as Flex Product (split)

Goal: match a line to a real schedule, trigger the “overage exceeds tolerance” prompt, then choose **Flex Product**.

### Setup

- Ensure you have a revenue schedule with expected amounts (e.g., expected usage = 100).
- Ensure tenant variance tolerance is low enough to trigger prompt (example: 1%).

### Steps

1. On the deposit reconciliation detail page, select:
   - one deposit line item, and
   - one target revenue schedule.
2. Enter an allocation that intentionally overpays beyond tolerance:
   - Example: schedule expected usage = 100, allocate usage = 130.
3. Click **Match**.
4. When the **Flex Resolution** modal appears (“Overage exceeds tolerance”), click **Flex Product**.

### Expected results / verification checklist

- A **child Flex Product** schedule is created:
  - `parentRevenueScheduleId = <base schedule id>`
  - `flexClassification = FlexProduct`
  - `flexReasonCode = OverageOutsideTolerance`
  - `scheduleDate = first day of deposit reporting month` (`YYYY-MM-01`)
  - `expectedUsage/expectedCommission` equal the split (the overage amount)
- Deposit matches are split:
  - base schedule match amount decreases by the split
  - flex schedule match amount equals the split
- Billing Status behavior:
  - Flex Product schedule is `InDispute`
  - base schedule is set to `InDispute` **when** billing status automation is enabled and the base schedule is still Auto-controlled
- A Flex Review Queue item is enqueued for the new flex schedule (status **Open**).

### Bonus/SPF guardrail test

If the target schedule is “bonus-like”, the modal should **not** offer Flex Product (only Adjust/Manual).

---

## 8) Workflow C — Resolve a Flex Product in the Flex Review Queue

Goal: take a Flex Product queue item and produce a concrete outcome.

Navigate to:
- `/reconciliation/flex-review`

Find your item (filters help):
- Status = `Open`
- Type (Classification) = `FlexProduct`
- Schedule search = schedule number or schedule id

### Option A — Apply to existing schedule

Use when: the Flex Product should be absorbed into an existing schedule.

Steps:
1. Click **Resolve** on the item.
2. Choose **Apply to existing schedule**.
3. Enter a target schedule id/number.
   - If the Flex Product is a child schedule, use the **Use parent** shortcut.
4. Click **Apply Resolution**.

Expected:
- Flex amount is added into the target schedule; deposit matches are moved.
- Flex schedule is retired (soft-deleted).
- Queue item becomes `Resolved` with `resolvedAt`.

### Option B — Convert to regular schedule

Use when: the Flex Product represents a real product that should exist as a normal schedule.

Steps:
1. Click **Resolve** on the item.
2. Choose **Convert to regular schedule**.
3. Pick **Product Family** and **Product Subtype**.
4. Click **Refresh list**, then choose the target **Product**.
5. (Optional) mark it **Recurring** and specify additional schedule count/start date.
6. Click **Apply Resolution**.

Expected:
- Flex schedule is converted to a normal schedule/product selection.
- For recurring conversions, additional month schedules may be created.
- Queue item becomes `Resolved`.

### Option C — Bonus commission (100% rate)

Use when: the Flex Product should be treated as a one-time bonus outcome.

Steps:
1. Click **Resolve** on the item.
2. Choose **Bonus commission (100% rate)**.
3. Click **Apply Resolution**.

Expected:
- Flex schedule is converted to a one-time bonus interpretation.
- Queue item becomes `Resolved`.

---

## 9) Evidence checklist (recommended for UAT)

Capture the following for each Flex Product test:
- Screenshots (before/after)
- IDs: `depositId`, `lineId`, `scheduleId`, `flexScheduleId`, `flexReviewItemId`
- Flex Review action chosen + any notes
- Before/after amounts (allocated/unallocated on the line; expected/actual on schedules)
- Billing Status values on base + flex schedules

---

## 10) Optional: automated verification (developer workflow)

Integration tests exist for Flex flows, but require a disposable Postgres database:
- Set `RUN_INTEGRATION_TESTS=1`
- Set `TEST_DATABASE_URL=<postgres url>`

Example (runs all tests; integration tests will run when env vars are set):
- `npm test`

Flex-related integration tests to look at:
- `tests/integration-reconciliation-variance-flex.test.ts`
- `tests/integration-billing-status-lifecycle.test.ts`
- `tests/integration-flex-review.test.ts`
