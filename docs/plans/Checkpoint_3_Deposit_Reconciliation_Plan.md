# Checkpoint 3 Plan — Deposit Upload + Reconciliation Acceptance

**Project:** Commissable CRM  
**Checkpoint:** 3 (Deposit Upload + Reconciliation)  
**Date Created:** 2026-01-13  
**Last Updated:** 2026-01-13  
**Primary Input:** `checkpoint_3_main_steps.md`  

## Goal

Meet the described behavior in `checkpoint_3_main_steps.md` by delivering:

1) A reliable deposit upload + field mapping flow for ACC / Advantix / Talaris files.  
2) Automated and manual matching from deposit lines to revenue schedules with configurable confidence thresholds.  
3) A first-pass “adjustment” workflow when actuals differ from expected amounts (including “apply to current” vs “propagate”).  
4) A “flex product” (or flex schedule) path for unmatched lines and significant discrepancies.  

## Current State (what exists today)

These already exist in the repo and should be used as the baseline:

- **Deposit Upload wizard (file → mapping → review → import)**: `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
- **Templates stored per Distributor/Vendor**: `ReconciliationTemplate` in `prisma/schema.prisma`
- **Import route persists Deposit + DepositLineItems**: `app/api/reconciliation/deposits/import/route.ts`
- **Suggested matches + manual match/unmatch**:
  - `GET /api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates`
  - `POST /apply-match`, `POST /unmatch`
- **Auto-match preview/apply (“Run AI Matching”)**:
  - `POST /api/reconciliation/deposits/[depositId]/auto-match/preview`
  - `POST /api/reconciliation/deposits/[depositId]/auto-match`
- **Finalize/unfinalize deposit**:
  - `POST /api/reconciliation/deposits/[depositId]/finalize`
  - `POST /api/reconciliation/deposits/[depositId]/unfinalize`
- **Config knobs exist**:
  - Tenant: variance tolerance, include future schedules, engine mode (`app/api/reconciliation/settings/route.ts`)
  - User: suggested threshold, auto-match threshold (`app/api/reconciliation/user-settings/route.ts`)

## Acceptance Criteria Mapping (from `checkpoint_3_main_steps.md`)

### 1) Data Upload and Mapping
**Acceptance intent:** upload vendor deposit files; map fields to canonical system fields; ingest cleanly.

**Planned completion items**
- Provide and store **real sample files** for ACC / Advantix / Talaris in a shared private location (not committed to repo), plus a small sanitized test fixture set (committable) if allowed.
- Ensure mapping supports the fields explicitly called out:
  - vendor name
  - product code (currently not a canonical deposit field)
  - billing month / commission period
  - usage amount
  - commission amount
- Make the mapping experience “repeatable” via templates per Distributor/Vendor.

### 2) Automated Matching with Configurable Confidence Thresholds
**Acceptance intent:** system suggests matches; user can auto-reconcile unmatched items using a confidence threshold and review high-confidence matches.

**Planned completion items**
- Align the product language and buttons:
  - “Reconcile” should mean **auto-match and apply** (with review), not “finalize/complete”.
  - “Finalize/Complete” should mean **close the deposit** after reconciliation is done.
- Add a **first-class threshold control** on the reconciliation UI (not only in Settings).
- Ensure auto-match uses the configured threshold (and that defaults match the checkpoint expectations).

### 3) Manual and Semi-Automated Adjustment Handling
**Acceptance intent:** when actual differs from expected, prompt for adjustment; allow current-only vs propagate; optionally auto-adjust within a configured variance.

**Planned completion items**
- Define what “adjustment” means in our data model (see “Open Decisions”).
- Add a guided prompt when a matched schedule remains materially under/over expected.
- Implement “apply to current schedule” and “propagate to future schedules”.
- Add optional “auto-adjust if within threshold” behavior behind a setting (or treat “within tolerance = reconciled” as the default “no prompt” path).

### 4) Flex Products for Unmatched / Significant Differences
**Acceptance intent:** for unmatched or significant differences, create a flex product (or equivalent) to account for discrepancies.

**Planned completion items**
- Implement a **FLEX emission** flow using `docs/reconciliation-flex-partial-design.md` as the initial spec:
  - Unknown product / no candidates → flex entry
  - Overage / significant difference after match → flex entry
- Add a review surface for flex entries and ensure it doesn’t block completing the deposit.

### 5) Future Enhancements (Version 2)
Treat as **out of scope** for checkpoint completion unless explicitly required:
- Multi-period AI change detection
- Pre-reconciliation review report generation

## Open Decisions (we should answer before coding)

1) **“Product code” definition for deposits**
   - Is this the vendor’s SKU/part number, our internal product code, or both?
   - Proposed: add a canonical deposit field `productCodeRaw` (optional) and store it on `DepositLineItem`.

2) **What adjustment should modify**
   - Option A (expected-side): update `RevenueSchedule.expectedUsage`/`expectedCommission` or `usageAdjustment` so expectations reflect reality.
   - Option B (actual-side): use `actualUsageAdjustment` / `actualCommissionAdjustment` to reconcile without changing expectations.
   - Proposed: **expected-side** for “propagate to future schedules” (this matches the wording), and a separate “one-time actual adjustment” option if finance needs it.

3) **What “flex product” means technically**
   - Option A: create a real `Product` flagged as FLEX and create `RevenueSchedule` rows against it.
   - Option B: create special “flex revenue schedules” without a product, but clearly labeled and reportable.
   - Proposed: Option A if downstream reporting expects `productId`; Option B if we want minimal schema changes.

4) Default confidence threshold called out as “70%”
   - Proposed: set default “suggested matches” to **70%**, keep auto-match higher (e.g., 95%) unless the business wants auto-match at 70%.

## Proposed Implementation Plan (phased)

### Phase 0 — Align terminology + confirm decisions (1–2 days)
- Confirm the four “Open Decisions” above with stakeholders.
- Confirm acceptance defaults:
  - suggested match display threshold
  - auto-match apply threshold
  - variance tolerance meaning and default value
- Produce a short demo script for checkpoint validation (upload → map → match → adjust/flex → finalize).

### Phase 1 — Data upload completeness for ACC / Advantix / Talaris (2–4 days)
- Collect sample files and identify common/unique columns for each vendor format.
- Extend canonical deposit fields as needed:
  - Add `productCodeRaw` (and any other truly required identifiers) end-to-end:
    - `lib/deposit-import/fields.ts`
    - mapping UI (`app/(dashboard)/reconciliation/deposit-upload-list/page.tsx` and deposit-upload components)
    - import persistence (`app/api/reconciliation/deposits/import/route.ts`)
    - Prisma model (`DepositLineItem`) if we want it queryable/reportable
- Create/seed templates for each vendor/distributor pair to minimize manual mapping:
  - Add or update template seeds where appropriate (Telarus-style seeding already exists).
- Add a “mapping QA checklist” per vendor:
  - headers recognized automatically
  - required fields satisfied
  - a clean import produces correct line items

**Exit criteria**
- ACC/Advantix/Talaris files can be uploaded and imported without manual “hacky” edits.
- Required fields land correctly on `DepositLineItem` records.

### Phase 2 — Matching UX + threshold behavior (2–4 days)
- Add threshold controls directly in reconciliation UI:
  - quick slider for “Suggested matches show >= X%”
  - quick slider or numeric input for “Auto-match applies >= Y%”
- Ensure auto-match preview/apply uses those settings (it already loads user prefs; ensure UX exposes them).
- Refactor button semantics:
  - Rename current finalize button to **Finalize Deposit** (or **Complete Deposit**).
  - Add **Reconcile (Auto-Match)** to run preview + apply and present “high-confidence matches” for approval.
- Add a “high-confidence” highlight in the UI (eligible vs below threshold) for transparency.

**Exit criteria**
- A user can adjust confidence threshold(s) and see immediate effect on suggestions and auto-match.
- The “Reconcile” action matches the checkpoint wording (auto-match unmatched items with review/approval).

### Phase 3 — Adjustment prompting + propagation (3–6 days)
- Define adjustment policy (expected-side vs actual-side) and implement:
  - When a match is applied, detect whether the schedule is still under/over expected beyond tolerance.
  - Show an “Adjustment” modal:
    - recommended adjustment amount(s)
    - apply to current schedule only
    - propagate forward (all future schedules for the same Opportunity Product)
    - optional: create a one-time offset entry instead of editing future expected values
- Implement propagation selector:
  - “All future schedules” vs “N months forward” vs “from schedule date forward”
- Ensure audit/history captures adjustment actions.
- Add an “undo” path (at minimum: revert last adjustment batch).

**Exit criteria**
- Users get prompted for mismatches and can resolve via current-only or propagation adjustments.

### Phase 4 — Flex products / flex schedules (3–6 days)
- Implement FLEX emission for:
  - **Unmatched** lines (no candidates / user leaves unmatched) when finalizing or by explicit action.
  - **Overage** cases when match is applied but a meaningful remainder exists.
- Add a review surface:
  - list flex entries with source deposit + line, account/vendor, amount, type (Unknown vs Overage), status.
- Decide how flex interacts with “Finalize Deposit”:
  - Option: allow finalize when flex entries are created and the original lines are marked handled.
- Add metrics (`flex_create`, `partial_allocate`) using the existing metrics logger.

**Exit criteria**
- Unmatched and significant-difference cases are not “dead ends”; they convert into flex entries that can be reviewed and accounted for.

### Phase 5 — QA + Acceptance Demo (1–2 days)
- Scripted walkthrough that explicitly covers the checkpoint bullets:
  - Upload ACC/Advantix/Talaris sample files
  - Map fields with templates and verify stored fields
  - Show suggested matches above threshold and manual matching
  - Run reconcile (auto-match) and review high-confidence matches
  - Trigger adjustment prompt and demonstrate current-only + propagate
  - Create a flex entry for an unmatched or overage line
  - Finalize and (optionally) unfinalize deposit
- Add/extend automated tests where patterns already exist (focus on import + matching + adjustment logic).

## References (existing docs/plans worth reusing)

- Deposit upload mapping overview: `docs/deposit-upload-mapping.md`
- Current auto-match behavior: `docs/reconciliation-ai-matching-current.md`
- FLEX scaffold: `docs/reconciliation-flex-partial-design.md`
- Prior matching plan: `docs/plans/12-4-25-Reconciliation-Matching-plan.md`
- Prior deposit upload plan: `docs/plans/12-4-25-Deposit-Upload-Implementation-Plan.md`

