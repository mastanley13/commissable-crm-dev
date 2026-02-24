# M2M Schedule Extension Guide

Date: 2026-02-24  
Scope: Month-to-month schedule continuation workflow (not reconciliation exception flex)

Related references:
- Flex exception guide: `docs/runbooks/Flex_Product_Guide.md`
- UAT test case: `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Guide.md` (TC-13)
- Job endpoint: `app/api/jobs/month-to-month-schedules/route.ts`
- Runner: `jobs/month-to-month-schedule-runner.ts`

---

## 1) Definitions

- **Schedule Extension (M2M)**: automatic monthly schedule continuation when a product is still billing and has no schedule in the target month.
- **Flex Product (Exception)**: reconciliation placeholder workflow for unknown/overage exceptions. Not the same feature.

---

## 2) Lifecycle model

Opportunity product status progression:

1. `ActiveBilling` -> first extension run creates new month schedule and transitions product to `BillingM2M`.
2. `BillingM2M` -> continues creating one schedule per month while deposits are still observed.
3. `BillingM2M` -> `BillingEnded` when no deposits are observed for configured threshold months (default: `3`).

---

## 3) Trigger and cadence

- Intended cadence: run on the 1st of each month (UTC).
- Endpoint:
  - `POST /api/jobs/month-to-month-schedules?date=YYYY-MM-DD`
  - Required header: `x-job-secret: $JOB_SECRET`

Example:

```bash
curl -X POST "http://localhost:3000/api/jobs/month-to-month-schedules?date=2026-03-01" \
  -H "x-job-secret: $JOB_SECRET"
```

---

## 4) Idempotency contract

For each eligible product:

- If a schedule already exists for target month, no new schedule is created.
- Running the job multiple times for the same target month should produce no duplicates.

---

## 5) No-deposit threshold

- Default threshold: `3` months.
- Tenant setting key: `reconciliation.m2mNoDepositThresholdMonths`.
- Endpoint override (for testing): `noDepositThresholdMonths=<int>`.

If a `BillingM2M` product has no qualifying deposits in the lookback window, it transitions to `BillingEnded`.

---

## 6) Dry-run mode

Use dry-run to preview actions without writing data:

```bash
curl -X POST "http://localhost:3000/api/jobs/month-to-month-schedules?date=2026-03-01&dryRun=true" \
  -H "x-job-secret: $JOB_SECRET"
```

Dry-run returns projected counts only.

---

## 7) Job output fields

`data` payload includes:

- `scannedCount`
- `createdCount`
- `skippedExistingCount`
- `skippedMissingAccountCount`
- `transitionedToM2MCount`
- `transitionedToBillingEndedCount`
- `noDepositThresholdMonths`
- `errors[]`

Use these counts as operational telemetry for job health and audit.

---

## 8) UAT checklist (TC-13)

1. Seed/create an `ActiveBilling` opportunity product with a prior-month schedule.
2. Run endpoint for target month.
3. Verify one schedule created for target month and status transitioned to `BillingM2M`.
4. Run endpoint again same month and verify no duplicate.
5. For no-deposit scenario, run with threshold override and verify transition to `BillingEnded`.

