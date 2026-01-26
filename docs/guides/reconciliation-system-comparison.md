# Reconciliation System (Spec) vs Current Implementation — Comparative Analysis

Date: 2026-01-22  
Scope: Compare the behavior described in `Reconciliation System.docx.md` (the “spec doc”) to how reconciliation works **today** in this repo (code + docs).

## Executive summary

The current system already supports the **core deposit-based reconciliation loop** the spec describes:

- Upload a deposit file → create `Deposit` + `DepositLineItem`s (templates + field mapping supported).
- Suggest matches between deposit lines and expected `RevenueSchedule`s (deterministic scoring + confidence).
- Apply matches (allocations) with support for split allocations (line → many schedules) and merge allocations (many lines → one schedule).
- Recompute schedule variance and handle exceptions via **adjustments**, **flex schedules**, and a **chargeback approval workflow**.
- Finalize (lock) a deposit to prevent further editing.

Where the spec diverges is mostly in **governance semantics and lifecycle UX**:

- The spec is built around a user-facing **Billing Status** concept: `Open | Reconciled | In Dispute`, plus “Collections” handling and related operational reports.
- The current implementation models reconciliation status as:
  - `RevenueSchedule.status = Unreconciled | Underpaid | Overpaid | Reconciled`
  - plus `flexClassification` / `flexReasonCode` on schedules, and a `FlexReviewItem` queue for management review/approval.
- The spec’s “Flex schedule is a child of the parent (1234.1) and sets parent + flex to In Dispute” is **not how the current system records flex**. Current flex schedules are one-time schedules with classification/reason codes; parent-child linkage is not used for flex splits.
- The spec’s structural “consolidation/expansion” workflows (one-to-many and many-to-one restructuring of products/schedules) are not implemented as prescribed; instead, current data modeling + matching supports many-to-many allocations without restructuring the underlying opportunity product set.
- The spec’s “metadata propagation and catalog enrichment” loop is only partially satisfied today (templates improve over time; deposit line metadata exists), but there is no implemented loop that updates Product Catalog / Opportunity Products based on matched deposits.

Net: the current system covers the **mechanical reconciliation problem**, but not the spec’s full **operational model** (billing status, disputes/collections reporting, structural reshaping, and the “rename/assign flex product” UX).

## Sources used for “current system”

Primary current docs:

- `docs/guides/reconciliation.md` — reconciliation workflow, routes, APIs, and operational notes.
- `docs/guides/deposit-upload.md` — deposit upload workflow, templates, required mappings.
- `docs/guides/automated-checklist-results-deposit-upload-reconciliation-2026-01-21.md` — test coverage notes and runnable checklist outcomes.

Primary implementation touchpoints (read-only references):

- Matching: `lib/matching/deposit-matcher.ts`, `lib/matching/revenue-schedule-status.ts`, `lib/matching/settings.ts`
- Flex: `lib/flex/revenue-schedule-flex-actions.ts`, `lib/flex/revenue-schedule-flex-decision.ts`
- Flex review queue: `app/api/flex-review/**`, `app/(dashboard)/reconciliation/flex-review/page.tsx`
- Deposit import: `app/api/reconciliation/deposits/import/route.ts`, `lib/deposit-import/**`
- Reconciliation APIs: `app/api/reconciliation/deposits/**`
- Data model: `prisma/schema.prisma`

## Terminology mapping (spec doc → current)

| Spec doc term | Closest current concept | Notes |
|---|---|---|
| Deposit file | Deposit Upload wizard + `Deposit` / `DepositLineItem` | Same core concept. |
| Opportunity Product schedules | `RevenueSchedule` rows | Current reconciliation allocates deposit lines to `RevenueSchedule`. |
| Match suggestion | Candidates endpoint + scoring engine | Deterministic scoring; “AI Matching” naming is UI/feature terminology. |
| Billing Status (Open/Reconciled/In Dispute) | `RevenueSchedule.status` + `flexClassification` + Flex Review queue | No single Billing Status field like spec describes. |
| Flex Product | Flex schedule with `flexClassification = FlexProduct` | Implemented, but not as a child schedule “1234.1”. |
| Flex Chargeback | Flex schedule with `flexClassification = FlexChargeback` | Implemented, with manager approval gating. |
| Collections | (Not implemented as a first-class flag/report) | Underpayments exist as `RevenueSchedule.status = Underpaid`, but no collections workflow. |

## Side-by-side workflow comparison

### 1) Deposit ingestion

**Spec doc**

- Deposit files come in monthly (PDF/CSV), uploaded, mapped via templates, mapping saved for future uploads.

**Current**

- Deposit Upload wizard creates:
  - `Deposit` (with `paymentDate` and `month` commission period)
  - `DepositLineItem` rows
  - `ImportJob` audit record (idempotency key prevents duplicates)
- Mapping templates are stored as `ReconciliationTemplate` records (scoped to tenant + distributor + vendor + template name) and updated on successful import when the “save mapping updates” toggle is enabled.

**Notes / deltas**

- Spec mentions PDFs as sources; current upload supports CSV and Excel (`.csv`, `.xls`, `.xlsx`) per docs; PDF ingestion is not currently described as supported.
- Current import supports “commission-only rows” (commission present, usage blank) by normalizing them (usage = commission, commissionRate = 100%).

### 2) Match suggestion / candidate generation

**Spec doc**

- Suggest matches based on shared keys (Order ID, Customer ID, Account ID, etc.) and improve over time.

**Current**

- Suggested matches are generated via a scoring engine with confidence (0–1), with “hierarchical” and “legacy” modes.
- Candidate filtering includes tenant scoping, date windows, schedule status, and remaining balance logic (per the current docs).

**Notes / deltas**

- “Learning” today is primarily:
  - Better mapping templates (columns → canonical fields) over time.
  - Better data quality on deposit lines and schedules as users standardize identifiers.
- There is not an implemented loop that updates catalog product metadata based on matched deposits (see “Metadata propagation” section).

### 3) Allocation (applying a match)

**Spec doc**

- User confirms match; system allocates actual usage/commission to expected schedules; variance is calculated.

**Current**

- Allocation is persisted via `DepositLineMatch` (many-to-many between `DepositLineItem` and `RevenueSchedule`) with `Applied` status.
- Allocation supports:
  - Partial allocations (line can be split across schedules)
  - Many lines paying a single schedule (merge)
- Post-allocation, the system recomputes:
  - `RevenueSchedule.actualUsage`, `actualCommission`, and `status`
  - Deposit and line-item allocation aggregates

### 4) Variance handling

**Spec doc**

- Within tolerance: “auto-adjust the existing schedule” and optionally apply forward.
- Outside tolerance:
  - Overage: create Flex Product / Flex Schedule; set parent + flex to “In Dispute”.
  - Underpayment: auto-adjust and flag for Collections.

**Current**

- Tolerance is a tenant setting: `reconciliation.varianceTolerance` (0–1, UI shows percent).
- After an allocation, the system evaluates variance:
  - If **within tolerance** and there is overage: it automatically creates an **Adjustment**-classified schedule (a split) to absorb the overage.
  - If **outside tolerance** and there is overage: UI prompts user for a resolution path (`Adjust`, `Manual`, or `FlexProduct`), and can optionally apply expected deltas to future schedules (for `Adjust`).
  - If there is **underpayment**: the schedule becomes `Underpaid` (status), but there is not a “Collections” flag/report layer implemented.

**Notes / deltas**

- The spec’s “auto-adjust the existing schedule” is implemented in a different way:
  - Current behavior creates an **Adjustment** schedule via a split (and/or uses `usageAdjustment` on future schedules), instead of rewriting the base schedule’s expected usage.
- “Collections” is a conceptual gap:
  - Underpayment is represented, but operational escalation/reporting isn’t modeled as “Collections” today.

### 5) Chargebacks (negative amounts)

**Spec doc**

- Negative lines create Flex Chargeback; if usage missing, derive usage = commission, commission rate = 100%; set “In Dispute”.

**Current**

- Negative usage/commission lines are treated as chargebacks:
  - A `FlexChargeback` schedule is created and a **Suggested** (pending) match is created.
  - A manager must approve the match via the Flex Review Queue (or approve endpoint) before it becomes applied.

**Notes / deltas**

- This is a meaningful workflow difference:
  - The spec describes auto-creating an “In Dispute” placeholder allocation.
  - Current system adds a governance step (manager approval) before applying.

### 6) Flex lifecycle and resolution UX

**Spec doc**

- Flex Product is temporary holding.
- After investigation, user “renames” flex product to an actual catalog product via a guided popup:
  - Distributor/Vendor locked
  - User selects House Product Family/Subtype/Product
  - Optionally generates future schedules for recurring items
  - Clears “In Dispute” on parent + flex
  - Potentially updates catalog for missing product instances

**Current**

- Flex schedules are created with `flexClassification` + `flexReasonCode` and are pushed into a `FlexReviewItem` queue for management workflow.
- There is no equivalent guided “assign/rename flex product” UX that:
  - re-links flex schedules to a real product,
  - optionally generates new schedules,
  - and clears a parent “dispute” status (because dispute status is not modeled that way).

## Data model comparison

### Core reconciliation entities (current)

- `Deposit` + `DepositLineItem` represent an imported vendor/distributor payout report and its rows.
- `RevenueSchedule` represents expected revenue/commission for a customer/product/period.
- `DepositLineMatch` stores allocations between deposit lines and schedules (many-to-many).
- Flex-specific fields are represented on `RevenueSchedule` via:
  - `flexClassification` (`Normal | Adjustment | FlexProduct | FlexChargeback | FlexChargebackReversal | Bonus`)
  - `flexReasonCode` (e.g., `OverageWithinTolerance`, `OverageOutsideTolerance`, `UnknownProduct`, etc.)
- Flex review governance is represented via `FlexReviewItem` (queue, assignment, approve/apply for chargeback types).

### Billing status / dispute model (spec) vs current

**Spec expects**

- A “Billing Status” field on revenue schedules: `Open | Reconciled | In Dispute`.
- Dispute and Collections reports driven by those statuses/flags.

**Current implements**

- Reconciliation “state” is a combination of:
  - `RevenueSchedule.status` (variance result)
  - `Deposit.reconciled` / `DepositLineItem.reconciled` / `DepositLineMatch.reconciled` (finalization/locking)
  - Flex review queue records and schedule `flexClassification` / `flexReasonCode`

**Implication**

If the spec doc is meant to be the definitive operational model, the current system would need either:

1) A true `billingStatus` field on schedules (and consistent semantics across schedules/products), or  
2) A translation layer (computed status) that maps existing state into the spec’s “Billing Status” values, plus reporting on top.

## Structural misalignment (many-to-one / one-to-many) — spec gap

**Spec doc**

- Detects and resolves:
  - Many deposit items → one schedule (group by keys, compare totals, user confirm).
  - One deposit item → many schedules (consolidation workflow that rebuilds products/schedules to align with deposit structure).

**Current**

- Supports many-to-one and one-to-many **allocations** via `DepositLineMatch`.
- Does not implement the spec’s “rebuild/consolidate” workflows that restructure Opportunity Products and their future schedules.

**Practical impact**

- Users can still reconcile correctly (money can be allocated), but the system will not “reshape” future expectation structure to reduce future manual effort in the way the spec outlines.

## Metadata propagation / “learning over time” — partial alignment

**Spec doc**

- After a match, deposit metadata should propagate to Opportunity Products and the Product Catalog to improve future matching accuracy.

**Current**

- Deposit Upload supports mapping a wide variety of “product/opportunity/matching” fields into `DepositLineItem.metadata`.
- Templates evolve (mapping config saved back to `ReconciliationTemplate`) which reduces repeated mapping effort.
- The matching engine currently uses explicit fields and does not implement a write-back loop to update `Product` / `OpportunityProduct` data from deposit matches.

**Practical impact**

- Matching quality improves mostly through:
  - better ingestion mapping and cleaner inputs,
  - not through automated catalog enrichment.

## Current features that are not called out in the spec doc

- **Chargeback reversals**: Current system supports a `FlexChargebackReversal` flow (positive lines tied to a parent chargeback schedule) with approval gating.
- **Flex Review Queue**: Current system has a dedicated queue with assignment filters and “Approve & Apply” flows for chargeback-like items.
- **AI adjustment preview/apply**: There are endpoints to suggest whether to allocate across prior open schedules vs adjust expected, and to apply adjustment splits with optional forward application.
- **Finalize/reopen**: Deposit finalization locks editing using reconciled flags; behavior and edge cases are documented in `docs/guides/reconciliation.md`.
- **Automated test coverage**: Deposit import parsing, mapping heuristics, and flex decision logic have unit/integration test coverage (some integration tests are gated behind env vars).

## Recommendations / decision points (if the spec is the target)

This section is intentionally framed as choices, because the spec and current system embody different “operational truth” models.

### A) Decide how “In Dispute” is represented

Options:

1) Implement a first-class `billingStatus` on schedules (and/or products), aligning directly to the spec.  
2) Keep current `RevenueSchedule.status` + `flexClassification` and introduce a computed “Billing Status” for UI/reporting.

Key question to resolve:

- Should the “parent schedule” become “In Dispute” when a flex schedule is created (spec), even if the parent is now balanced after splitting allocations (current)?

### B) Decide whether structural reshaping is required

If the consolidation/expansion workflows are a must-have, it likely requires:

- Creating/editing Opportunity Products based on reconciliation outcomes.
- Creating/removing future revenue schedules in bulk.
- Clear auditability and idempotency to avoid schedule drift.

If it is not required, current many-to-many allocation may be sufficient operationally (with some UX improvements).

### C) Decide whether catalog enrichment is required

If the “learning loop” is desired as described, the system needs:

- A governed workflow for updating catalog product metadata based on deposits (and avoiding bad writes).
- Potentially a controlled merge process (suggest → approve → apply) similar to Flex Review.

## Appendix: quick pointers

- Spec doc: `Reconciliation System.docx.md`
- Current reconciliation guide: `docs/guides/reconciliation.md`
- Current deposit upload guide: `docs/guides/deposit-upload.md`
- Current checklist results (as of 2026-01-21): `docs/guides/automated-checklist-results-deposit-upload-reconciliation-2026-01-21.md`

