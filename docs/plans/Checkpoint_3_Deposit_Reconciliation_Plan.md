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

## Progress / Status (as of 2026-01-13)

### Completed
- **Confidence defaults aligned to v1**:
  - Suggested matches default = **70%**
  - Auto-match default = **95%**
  - Implemented in both backend defaults and UI initial state:
    - `lib/matching/user-confidence-settings.ts`
    - `components/deposit-reconciliation-detail-view.tsx`
    - `components/reconciliation-settings-form.tsx`
- **“Product code” implemented as Other - Part Number end-to-end**:
  - New canonical deposit field: `partNumberRaw` (`lib/deposit-import/fields.ts`)
  - Auto-mapping synonyms + mapping priority updated (`lib/deposit-import/template-mapping.ts`)
  - Telarus template label mapping supports both legacy and new labels:
    - `"Vendor - Part Number"` and `"Other - Part Number"` (`lib/deposit-import/telarus-template-master.ts`, `scripts/seed-telarus-reconciliation-templates.ts`)
  - Persisted on import (`app/api/reconciliation/deposits/import/route.ts`)
  - Returned on deposit detail (`app/api/reconciliation/deposits/[depositId]/detail/route.ts`)
  - Displayed as a line-item column and filter (`components/deposit-reconciliation-detail-view.tsx`)
- **FLEX product reuse policy implemented (accountId + flexType)**:
  - Product-level flags/metadata added: `isFlex`, `flexAccountId`, `flexType` (`prisma/schema.prisma`)
  - Flex creation now reuses an existing flex product when available (`lib/flex/revenue-schedule-flex-actions.ts`)
- **Validation**
  - Prisma client regenerated (`npm run db:generate`)
  - Tests pass (`npm test`)
  - Production build passes (`npm run build`)

### Pending (required to deploy these changes)
- Apply Prisma migration `prisma/migrations/20260113101500_reconciliation_templates_multi_idempotency/migration.sql` to the target database.

### Outlying incomplete items (from the Checkpoint 3 guides)
These are the remaining items still marked incomplete in:
- `Checkpoint3_Reconciliation_Master_Guide.md`
- `Checkpoint3_Reconciliation_Master_Guide_HANDOFF.md`

- **REC-002 (IN PROGRESS):** Mapping UI redesign final polish (wizard simplification if required).
- **REC-060 (IN PROGRESS):** Performance targets validation + capture baseline timings.
- **Readiness:** Performance sanity check run + documented.

---

## Plan to close the outlying incomplete items (ordered)

### Phase A — Template selection + persistence foundation (REC-001, REC-003)
**Goal:** Support multiple templates per (Distributor, Vendor) and make selection explicit and traceable.

1) **Data model decision (required)**
   - Add `Deposit.reconciliationTemplateId` (FK) OR store selected template id in `ImportJob.filters` and treat it as the source of truth for the import.
   - Recommendation: add the FK for long-term traceability + audit and to allow multiple templates per vendor/distributor without ambiguity.

2) **UI: explicit template selection (REC-001)**
   - Add a template dropdown after Distributor/Vendor selection.
   - Disable file upload and mapping until template is selected.
   - Show template metadata (name/description/updatedAt).

3) **Import behavior**
   - Include selected template id in the import request and persist it (either on `Deposit` or `ImportJob.filters`).
   - Ensure the mapping seed uses the selected template’s `config`.

4) **Template editing rules (REC-003)**
   - Introduce a template “Save as new version” behavior:
     - Editing an existing template creates a new template row (or new `configVersion`), leaving prior templates intact.
     - New uploads default to the newest template for that pair, but users can pick older ones.
   - Add “Duplicate template” for quick variants per vendor/distributor.

**Exit criteria**
- Multiple templates for the same vendor/distributor are supported.
- Deposit imports have a deterministic template lineage.

### Phase B — Mapping UX redesign (REC-002) + safety affordances
**Goal:** Replace the wizard with a two-panel mapping editor that supports cancel + undo and reduces user errors.

1) **UX structure**
   - Panel A: canonical fields (required + common optional), with current mapping + inline validation.
   - Panel B: “Extra columns” that are non-blank and not mapped.
   - Keep a persistent preview pane (1–5 rows) that updates live.

2) **Undo/Cancel**
   - Local undo stack (per mapping change).
   - Cancel returns to template selection without persisting changes.

3) **Validation hardening**
   - Block continue/import until required fields are mapped and preview parses cleanly (usage/commission).
   - Show clearly which required fields are missing.

**Exit criteria**
- Wizard steps removed; mapping can be completed in one screen.
- Cancel/Undo behavior matches acceptance intent.

### Phase C — Matching parity and confidence tuning (REC-022)
**Goal:** Align candidate generation/scoring with Milestone 3 spec and lock predictable behavior.

1) **Define a parity checklist**
   - List the exact matching signals/priority order required by the Milestone 3 spec.
   - Decide thresholds for suggest/auto-match, cross-vendor fallback caps, date windows, ID matching precedence.

2) **Test harness**
   - Create a small deterministic fixture set (deposit line + schedules) with expected top-N ordering.
   - Add unit tests around scoring and candidate filtering so future changes don’t regress.

3) **Tune**
   - Iterate on weights/thresholds and document final values.

**Exit criteria**
- Top-N candidates and confidence outputs are stable and spec-aligned.

### Phase D — Audit completeness (REC-051)
**Goal:** Ensure all critical reconciliation actions have audit events.

1) Add audit events for:
   - Deposit upload (deposit created + import job link + counts + file name).
   - Template create/update/versioning actions.
   - Allocation changes (`DepositLineMatch` create/update/delete) including amounts.
   - Adjustment/flex actions and future-schedule propagation (including impacted schedule ids/count).
   - Finalize/unfinalize deposit.

2) Add an audit review checklist to confirm required fields are present in `AuditLog.metadata`.

**Exit criteria**
- All actions listed in REC-051 are logged and queryable by deposit/template id.

### Phase E — Performance + idempotency (REC-060, REC-061, readiness)
**Goal:** Make uploads safe to retry and validate “large file” performance.

1) **Idempotency design (REC-061)**
   - Add an `idempotencyKey` to deposit import requests; store it on `ImportJob` (new field) with a uniqueness constraint (tenant + entity + key).
   - On retry with same key, return the previously created deposit id instead of creating duplicates.
   - Optional: compute server-side file hash and store it as a secondary guardrail.

2) **Performance baseline (REC-060)**
   - Pick a target “large file” size (rows + columns) based on the Milestone 3 spec.
   - Measure: upload parse time, insert time, candidates fetch time, auto-match preview/apply time.
   - Add indexes if query plans show scan hotspots (deposit line matches, schedule filters).

3) **Readiness check**
   - Run the performance sanity check and capture timings + notes in the checklist doc.

**Exit criteria**
- Retry-safe upload without duplicates.
- Documented timings meet agreed targets (or have a mitigation plan).

### Phase F — UI polish (REC-070, REC-071)
**Goal:** Standardize destructive actions and improve reconciliation clarity.

1) **REC-070**
   - Use the global modal pattern (`TwoStageDeleteDialog`) for all reconciliation delete actions.
   - Add a consistent “blockers legend” where statuses prevent actions (reconciled/locked/ignored).

2) **REC-071**
   - Ensure “Allocate vs Finalize” distinction is obvious in all headers/tooltips.
   - Standardize table labels/columns and ensure allocated/unallocated rollups are visible and consistent.

**Exit criteria**
- Delete flows are consistent.
- Reconciliation screens communicate the process clearly with minimal user confusion.

## Acceptance Criteria Mapping (from `checkpoint_3_main_steps.md`)

### 1) Data Upload and Mapping
**Acceptance intent:** upload vendor deposit files; map fields to canonical system fields; ingest cleanly.

**Planned completion items**
- Provide and store **real sample files** for ACC / Advantix / Talaris in a shared private location (not committed to repo), plus a small sanitized test fixture set (committable) if allowed.
- Ensure mapping supports the fields explicitly called out:
  - vendor name
  - product code = **Other - Part Number** (old label: **Vendor - Part Number**)
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
- Default adjustment behavior is **expected-side** (see “Locked Decisions (v1)”).
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

## Locked Decisions (v1)

### 1) Product code mapping for deposits
- **Decision:** “Product code” = **Other - Part Number** (legacy label: **Vendor - Part Number**).
- **Implementation intent:** add a canonical deposit field for this value and persist it on `DepositLineItem` (proposed field name: `partNumberRaw`), surfaced in reconciliation UI as **Other - Part Number**.

### 2) Adjustments default to expected-side (propagatable)
- **Decision:** default adjustment modifies the schedule’s **expected-side effective values** (base + adjustments) so reconciliation stays explainable and future periods are consistent.
- **Why:** matches “propagate to future schedules” semantics and keeps expectations aligned going forward.
- **Implementation intent (expected-side):**
  - Apply to current schedule only, or propagate forward (same Opportunity Product).
  - Use existing expected-side adjustment primitives where possible:
    - `RevenueSchedule.usageAdjustment` for usage expected-side.
    - Commission expected-side adjustment should be stored explicitly as an expected adjustment (note: current code treats `RevenueSchedule.actualCommissionAdjustment` as an “expected commission adjustment” in list/detail helpers; keep semantics consistent in v1 and consider renaming later).

### 2b) One-time actual adjustment (finance-only, separate action)
- **Decision:** keep “one-time actual adjustment” as an explicit, separate action (not default).
- **Behavior:**
  - Does **not** propagate.
  - Requires explicit user selection + required reason.
  - Writes to actual-adjustment storage (`actual_*_adjustment` fields and/or a dedicated adjustment table) without changing the expected-side baseline.
  - Should be permission-gated (finance/admin).

### 3) Flex is a real Product referenced by `RevenueSchedule.productId`
- **Decision:** flex is implemented as a real `Product`, flagged as FLEX, and flex revenue schedules reference `productId`.
- **Why:** reporting/rollups/filters assume `productId` exists; FLEX should behave like any other product line item but categorized.

### 3b) Flex reuse policy (locked)
- **Decision:** reuse flex products when **same `accountId` + `flexType`** already exists; otherwise create a new flex product.
- **Implementation intent:**
  - Add product-level fields to support this (e.g., `isFlex`, `flexType`, and `flexAccountId` or equivalent).
  - Flex schedules should also stamp `RevenueSchedule.flexClassification`, `RevenueSchedule.flexReasonCode`, and source deposit IDs (`flexSourceDepositId`, `flexSourceDepositLineItemId`).

### 4) Confidence thresholds (locked defaults)
- **Decision:** suggested matches default display threshold = **70%**; auto-match apply threshold = **95%** (v1 safety).
- **Behavior spec:**
  - Suggested list shows items where `matchConfidence >= 0.70`.
  - User can slide threshold down/up (persist per-user optional).
  - Auto-match only applies when `matchConfidence >= 0.95` **and** there are no conflicts (e.g., clear top candidate; no ambiguity/competition).
  - Auto-match should continue to respect existing “one schedule per deposit line” constraints unless/until partial allocations are explicitly enabled.

## Proposed Implementation Plan (phased)

### Phase 0 — Align terminology + confirm decisions (1–2 days)
- Confirm the locked decisions above with stakeholders and adjust only if business requires changes.
- Confirm acceptance defaults:
  - suggested match display threshold
  - auto-match apply threshold
  - variance tolerance meaning and default value
- Produce a short demo script for checkpoint validation (upload → map → match → adjust/flex → finalize).

### Phase 1 – Data upload completeness for ACC / Advantix / Talaris (2–4 days)
- Collect sample files and identify common/unique columns for each vendor format.
- Extend canonical deposit fields as needed:
  - ✅ Add **Other - Part Number** (`partNumberRaw`) end-to-end:
    - Canonical field: `lib/deposit-import/fields.ts`
    - Auto-mapping: `lib/deposit-import/template-mapping.ts`
    - Telarus mapping: `lib/deposit-import/telarus-template-master.ts`, `scripts/seed-telarus-reconciliation-templates.ts`
    - Import persistence: `app/api/reconciliation/deposits/import/route.ts`
    - Deposit detail API: `app/api/reconciliation/deposits/[depositId]/detail/route.ts`
    - Reconciliation UI column: `components/deposit-reconciliation-detail-view.tsx`
    - DB migration: `prisma/migrations/20260113093000_add_deposit_part_number_and_flex_product_fields/migration.sql`
- Create/seed templates for each vendor/distributor pair to minimize manual mapping:
  - Add or update template seeds where appropriate (Telarus-style seeding already exists).
- Add a “mapping QA checklist” per vendor:
  - headers recognized automatically
  - required fields satisfied
  - a clean import produces correct line items

**Exit criteria**
- ACC/Advantix/Talaris files can be uploaded and imported without manual “hacky” edits.
- Required fields land correctly on `DepositLineItem` records.

### Phase 2 – Matching UX + threshold behavior (2–4 days)
- ✅ Threshold controls exist in reconciliation UI and persist per-user:
  - Suggested slider + Auto slider: `components/deposit-reconciliation-detail-view.tsx`
  - Defaults updated to Suggested **70%** and Auto **95%**
- ✅ Auto-match preview/apply uses user thresholds (API reads per-user preferences).
- Refactor button semantics:
  - Rename current finalize button to **Finalize Deposit** (or **Complete Deposit**).
  - Add **Reconcile (Auto-Match)** to run preview + apply and present “high-confidence matches” for approval.
- Add a “high-confidence” highlight in the UI (eligible vs below threshold) for transparency.

**Exit criteria**
- A user can adjust confidence threshold(s) and see immediate effect on suggestions and auto-match.
- The “Reconcile” action matches the checkpoint wording (auto-match unmatched items with review/approval).

### Phase 3 — Adjustment prompting + propagation (3–6 days)
- Implement default expected-side adjustments + propagation:
  - When a match is applied, detect whether the schedule is still under/over expected beyond tolerance.
  - Show an “Adjustment” modal:
    - recommended adjustment amount(s)
    - apply to current schedule only
    - propagate forward (all future schedules for the same Opportunity Product)
- Implement a separate finance-only “One-time actual adjustment” action (explicit selection + reason; no propagation).
- Implement propagation selector:
  - “All future schedules” vs “N months forward” vs “from schedule date forward”
- Ensure audit/history captures adjustment actions.
- Add an “undo” path (at minimum: revert last adjustment batch).

**Exit criteria**
- Users get prompted for mismatches and can resolve via current-only or propagation adjustments.

### Phase 4 – Flex products / flex schedules (3–6 days)
- Implement FLEX emission for:
  - **Unmatched** lines (no candidates / user leaves unmatched) when finalizing or by explicit action.
  - **Overage** cases when match is applied but a meaningful remainder exists.
- Add a review surface:
  - list flex entries with source deposit + line, account/vendor, amount, type (Unknown vs Overage), status.
- ✅ Implement FLEX product reuse policy:
  - Reuse when same `accountId` + `flexType` exists, else create a new flex product.
  - Implementation: `lib/flex/revenue-schedule-flex-actions.ts`
  - Requires DB migration: `prisma/migrations/20260113093000_add_deposit_part_number_and_flex_product_fields/migration.sql`
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
- FLEX schedules handoff notes: `flex-revenue-schedules-handoff.md`
- Prior matching plan: `docs/plans/12-4-25-Reconciliation-Matching-plan.md`
- Prior deposit upload plan: `docs/plans/12-4-25-Deposit-Upload-Implementation-Plan.md`
