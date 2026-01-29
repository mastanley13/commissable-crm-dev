# Plan: Align Current Reconciliation With “Reconciliation System” Outline

This plan is based on:

- Spec: `Reconciliation System.docx.md`
- Current-state analysis: `docs/guides/reconciliation-system-comparison.md`

## Goals (what “aligned” means)

Implement the missing behaviors and UX described in the spec so that reconciliation operates with:

1) A clear **Billing Status** lifecycle (`Open | Reconciled | In Dispute`) at the schedule level (and where applicable, at the product level).  
2) First-class **Disputes** + **Collections** handling with the required operational **reports**.  
3) Spec-defined **Flex Product** behavior (including resolution UX) and structural **one-to-many / many-to-one** workflows.  
4) A governed **metadata propagation** loop that improves future matching.

## Non-goals (explicitly out of scope unless requested)

- Changing the deposit upload workflow beyond what’s needed to support spec matching/enrichment.
- Replacing the current deterministic matching engine with external ML/LLM.
- Reworking unrelated Opportunity/Product lifecycle behavior outside the reconciliation context.

## Phase 0.0 — Discovery (inputs + success metrics)

Before changing schema/workflows, collect inputs that de-risk the build and prevent spec misinterpretation:

- **Scenario matrix:** Gather 10–20 real deposit examples covering: clean match, many-to-one, one-to-many, overage within tolerance, overage outside tolerance, underpayment outside tolerance, chargeback (negative commission), chargeback reversal, and unknown product.
- **Data availability check:** Confirm which identifiers are reliably present across vendors (order IDs, customer IDs, account IDs, SKUs/part numbers). Structural workflows depend on stable keys.
- **Schedule-date contract:** Confirm whether recurring `RevenueSchedule.scheduleDate` is always normalized to the 1st of the month (spec assumption) and what to do with legacy/edge-case dates.
- **Success metrics (baseline + target):** Define KPIs such as:
  - % lines auto-matched / suggested
  - median time-to-finalize deposit
  - disputed items count + aging
  - collections items count + aging
  - manual touches per deposit (proxy for operational effort)

Acceptance criteria:

- We have testable artifacts and a measurable definition of “aligned/better” before implementing structural changes.

## Phase 0 — Product decisions (required before building)

These decisions prevent building two overlapping “truth” models.

### 0.1 Decide the canonical interpretation of “Billing Status”

The spec uses Billing Status values that do not map 1:1 to current `RevenueSchedule.status`.

Decide:

- Is Billing Status a **stored field** (persisted), or a **computed projection** derived from existing state?
- When a flex schedule is created, should the **parent schedule** become `In Dispute` even if it is balanced after splitting allocations (spec), or remain “normal” with only the flex schedule disputed (current-friendly)?
- Does `In Dispute` block deposit finalization? (Today, finalization blocks only `Unmatched`/`Suggested` line states.)

### 0.2 Decide the governance model for chargebacks

Spec implies immediate “in dispute” placeholder allocation. Current system gates chargebacks via approval.

Decision (as of 2026-01-29):

- Keep approval gating, but always represent chargebacks as Billing Status = `In Dispute` (no “Pending” billing status).
- Model “pending approval” as a separate approval state/flag (not as Billing Status).
- Approval does **not** auto-clear Billing Status; disputes clear only via explicit settlement/resolution actions with an audit trail.
- Treat chargeback reversals as first-class, linked records (reversal points to the original chargeback) so the full story remains auditable/reportable.

### 0.3 Decide whether the spec’s structural reshaping is required

The spec’s one-to-many consolidation workflow modifies Opportunity Products and rebuilds future schedules. This is a significant operational change.

Decide:

- Must we implement consolidation/expansion, or can we treat the spec as “ideal UX” and keep many-to-many allocations only?

### 0.4 Decide catalog enrichment governance

Spec wants deposit metadata to enrich catalog/opportunity products.

Decide:

- Auto-write vs suggest-and-approve vs manual-only.
- Which fields are writable (e.g., vendor product name, part number, description, distributor fields).

### 0.5 Decide how Flex should be modeled (Opportunity Product vs schedule-only)

The spec describes Flex Product / Flex Chargeback as distinct Opportunity Products with their own schedule(s).

Decide:

- Do we implement flex as real `OpportunityProduct` rows (spec-aligned), or keep flex as schedules-only constructs (current model)?
- If we create `OpportunityProduct` records, how do they appear on Opportunity UI and how do they affect commission split logic and reporting?

### 0.6 Decide chargeback sign conventions (usage vs commission)

The spec’s chargeback example implies: negative commission with blank usage becomes positive usage derived from commission magnitude (commission remains negative).

Decide:

- Do we store chargeback usage as positive (gross withheld) while commission is negative (spec-friendly), or keep negative usage (current-friendly)?
- If we change conventions, how do we migrate existing deposits/schedules and prevent breaking aggregation math?

### 0.7 Decide finalization semantics (partial allocations + ignored lines)

Current finalization blocks only `Unmatched` / `Suggested` lines and allows `PartiallyMatched` lines to be finalized.

Decide:

- Does spec-alignment require blocking finalization unless every line is fully matched/ignored?
- How do `Ignored` lines map into the spec’s operational reporting (e.g., Unmatched Deposits report)?

### 0.8 Decide “direct vendor” handling (no distributor)

Spec calls out using a placeholder distributor (e.g., “None-Direct”) when a vendor contract has no distributor.

Decide:

- Is distributor always required in UI/data, or do we support vendor-only flows natively?
- How are templates and reports scoped when there is no distributor?

### 0.9 Decide whether PDF ingestion is required

Spec references PDF deposit files. Current guidance focuses on CSV/Excel.

Decide:

- Is PDF parsing required for spec completion, or is “PDF” just the source-of-truth document that finance exports to CSV for upload?

### 0.10 Clarify the role of the existing `Reconciliation` model

The schema contains both `Reconciliation`/`ReconciliationItem` and the `Deposit`-based reconciliation workflow.

Decide:

- Is `Reconciliation` legacy/unused, or should it become the canonical rollup for the spec’s “Reconciliation Summary” reporting?

## Phase 1 — Data model alignment (Billing Status + Collections + Disputes)

### 1.1 Add Billing Status representation

Implement one of:

- **Stored** `RevenueSchedule.billingStatus` enum: `Open | Reconciled | InDispute`, or
- **Computed** billing status + persist only “dispute markers” (e.g., `isDisputed`, `disputedAt`, `disputeReason`).

Recommended: stored `billingStatus` because spec requires consistent UI + reporting and calls out missing field on the schedule detail layout.

### 1.2 Add Collections flagging

Add a first-class “Collections” indicator on schedules (or on a related entity), driven by underpayment outside tolerance.

Minimum viable:

- `RevenueSchedule.collectionsStatus`: `None | NeedsFollowUp | Resolved`
- `collectionsMarkedAt`, `collectionsNotes`, `collectionsAssignedToUserId` (optional but useful).

### 1.3 Add dispute metadata

To support dispute reporting and settlement options:

- `disputeReasonCode` / `disputeNotes`
- `disputedAt`, `disputedById`
- settlement state (e.g., `AcceptedActual | WriteOff | Escalated`) if needed for reporting

### 1.3.1 Implement dispute settlement actions

Spec calls out explicit settlement options:

- **Accept Actual Amount** (and optionally apply forward)
- **Write Off Variance**
- **Escalate** (remain disputed)

Implement:

- API endpoints + UI actions to apply each settlement option.
- Audit trail + permission gating (management/finance roles).

### 1.4 Backfill / migration plan

Define how existing schedules map into the new fields:

- If `RevenueSchedule.status = Overpaid` and created via flex → likely `In Dispute`.
- If `RevenueSchedule.status = Underpaid` and outside tolerance → likely `Collections`.
- If `RevenueSchedule.status = Reconciled` → likely `Reconciled`.
- Otherwise → `Open`.

Acceptance criteria:

- All existing schedules have a deterministic billing status after migration.
- No behavior regressions in existing reconciliation endpoints.

## Phase 2 — Status + variance behavior alignment

### 2.1 Align “within tolerance” auto-adjust semantics

Spec: auto-adjust schedule; optionally apply forward.
Current: creates an adjustment split schedule + can apply expected deltas forward.

Action:

- Decide whether the spec expects expected-amount mutation on the base schedule vs the current “adjustment schedule + future deltas” approach.
- Update UI copy/workflow so it matches the chosen model (and remove ambiguity for Finance users).

Acceptance criteria:

- For within-tolerance overage, the system resolves without requiring manual steps, and Billing Status remains non-disputed.

### 2.2 Underpayment outside tolerance → Collections workflow

Implement:

- Detection rule for “underpayment outside tolerance”
- Auto-mark schedule for Collections
- Ensure it appears in Collections report (Phase 7)

Acceptance criteria:

- Underpayment outside tolerance results in `Collections` flag + remains visible until resolved.

## Phase 3 — Flex Product behavior (child schedule numbering + rename/assign flow)

### 3.0 Align flex “catalog identity” rules

Spec expects Flex Chargeback (and likely Flex Product patterns) to be present per Distributor+Vendor combination.

Implement:

- Decide uniqueness for flex products (per customer account vs per distributor+vendor vs both).
- Ensure created flex products carry correct distributor/vendor metadata for reporting and downstream matching.

### 3.1 Implement spec-style flex “child schedule” relationship + naming

Spec expects:

- Flex schedule as a child of the parent schedule (example numbering: `1234.1`).

Implementation work:

- Use existing `RevenueSchedule.parentRevenueScheduleId` for flex splits (not only chargeback reversals).
- Extend schedule numbering logic to support child suffixing derived from the parent schedule number.

Acceptance criteria:

- Flex schedules created from a base schedule have `parentRevenueScheduleId = base.id`.
- Display name for flex schedules shows `parentNumber + .N` consistently.

### 3.2 Set “In Dispute” semantics for flex

Spec expects parent + flex to be In Dispute for overage outside tolerance.

Implement the chosen model from Phase 0:

- Update Billing Status for flex schedule (and optionally parent schedule).
- Ensure dispute report picks them up.

### 3.3 Flex Product resolution UX (“Rename / Assign Product”)

Build the spec’s guided flow:

- Entry point: from flex schedule/product row (e.g., “Assign Product”).
- Pre-populated locked fields: Distributor/Vendor.
- User selects: House Product Family → Subtype → Product.
- Optional step: create additional schedules (recurring) starting at user-selected date.
- Preserve financials already allocated to the flex schedule.
- Clear dispute flags when resolved.

Implementation notes:

- This likely needs:
  - a modal UI in the reconciliation/flex context,
  - an API endpoint to perform relinking + optional schedule creation,
  - audit logging and idempotency protections.

Acceptance criteria:

- A flex schedule can be re-linked to a real product and optionally spawn future schedules without breaking reconciliation history.

### 3.4 Flex resolution types (management closure)

Implement a “Resolve Flex” action that removes items from the operational dispute queue with an explicit resolution type + reason:

- `ApplyToExisting` (may clear base schedule dispute only when it is the last remaining disputed flex child)
- `ConvertToPermanent`
- `AcceptAsOneTime`

Implementation note:

- Keep the resolution API and audit schema consistent with `docs/plans/billing-status-settlement-and-flex-resolution-implementation-plan.md`.

## Phase 4 — Chargeback workflow alignment

### 4.1 Make chargebacks match spec outcomes while preserving approvals (recommended)

Implement:

- Chargeback schedules always have Billing Status = `In Dispute`.
- Pending approval state remains, but the schedule is still reportable as “in dispute”.
- Approval may apply allocations/state transitions as needed, but **does not** automatically change Billing Status out of `In Dispute`.
- Clearing/closing a chargeback dispute is an explicit settlement-style action with a required reason and audit entry.

Acceptance criteria:

- Chargeback items show up on the Dispute report whether approved or pending.
- Approving a chargeback writes an approval audit event and preserves traceability, without silently removing the item from dispute workflows.

### 4.2 Align chargeback normalization to spec (if adopted)

If Phase 0.6 chooses spec-style sign conventions:

- Ensure chargeback creation uses the expected usage/commission sign rules.
- Ensure commission-rate calculations and rollups remain correct.
- Add regression tests for negative commission + blank usage cases.

## Phase 5 — Structural misalignment workflows (many-to-one / one-to-many)

This is the largest delta vs current behavior.

### 5.1 Many-to-one detection + UX

Spec: multiple deposit lines should map to one schedule.

Implement:

- Grouping logic (by stable keys like customer/order/account IDs).
- Candidate selection that considers group totals vs schedule remaining.
- UI to confirm “match this group to schedule X” and apply allocations as a batch.

Acceptance criteria:

- Users can reconcile a grouped set of lines with one action; allocation breakdown remains auditable per line.

### 5.2 One-to-many consolidation workflow

Spec: one deposit line should map to multiple schedules; system can consolidate products/schedules.

Implement:

- Detection that a single deposit line matches multiple schedules/products with high confidence.
- A guided “consolidate” action:
  - retire old open schedules from original products,
  - create a new consolidated product and schedules aligned to deposit structure,
  - move current/future expectations to the consolidated set.

Acceptance criteria:

- Consolidation is idempotent, audited, and does not corrupt historical reconciliation.
- Future deposits become easier to match (measurable reduction in manual work).

## Phase 6 — Metadata propagation (“learning loop”)

### 6.1 Define what metadata can be propagated

Start small with high-signal fields:

- Vendor/distributor product name
- Vendor/distributor part number / SKU
- Descriptions

### 6.2 Implement propagate-on-confirm (suggest → approve → apply)

Recommended governance:

- When a match is confirmed, generate “enrichment suggestions”:
  - update Product catalog and/or OpportunityProduct snapshots
- Route these suggestions through a review queue (can reuse Flex Review concepts or create a separate enrichment queue).

Acceptance criteria:

- Enrichment is never silently destructive; changes are reviewable and auditable.
- Matching accuracy improves over time due to better normalized metadata.

## Phase 7 — Reports (required by spec)

Build report pages + APIs with at least:

1) **Dispute Report** — schedules with Billing Status `In Dispute` (filters: distributor, vendor, date range, age).  
2) **Collections Report** — schedules flagged for Collections (filters: distributor, vendor, date range, amount).  
3) **Flex Product Aging** — unresolved flex items (age, amount).  
4) **Reconciliation Summary** — period overview by distributor/vendor (counts, totals, completion).  
5) **Unmatched Deposits** — deposit line items without matches (filters: distributor, vendor, date range).

Acceptance criteria:

- Reports match the spec’s operational needs and can be used as daily work queues.

## Phase 8 — UX alignment on Opportunity + Revenue Schedule screens

### 8.1 Opportunity Products tab columns

Spec requires:

- `# of Periods` (count of schedules for product)
- `# Remaining` (count of “Open/Unreconciled” schedules)

Implement:

- Server-provided counts or efficient query endpoints.
- Add columns to the Products table and ensure sorting/filtering works.

### 8.2 Revenue Schedule detail “Billing Status” field

Add Billing Status to the schedule detail UI per spec.

Acceptance criteria:

- Users can see (and if allowed, modify/resolve) billing status in the schedule detail view.

## Cross-cutting work (applies to all phases)

### Feature flags / rollout safety

Because several phases change “what the system believes is true,” plan a rollout strategy:

- Feature-flag new Billing Status semantics and reports (initially read-only if needed).
- Run old and new reports side-by-side for a period to confirm parity.

### Auditing

- Ensure every reconcile/flex/consolidation/enrichment mutation emits audit logs with enough metadata to reconstruct decisions.

### Permissions

- Align spec-required actions with role permissions (e.g., dispute settlement, collections marking, approvals).

### Performance & indexing

Reports and consolidation workflows can become query-heavy. Plan:

- Indexes for common report filters (tenant, vendor, distributor, status, age/date ranges).
- Query plans that avoid full scans on large schedule/deposit datasets.

### Observability / metrics

Add instrumentation so alignment work can be validated quantitatively:

- match rate, auto-match rate, and confidence distributions
- counts/aging of disputed and collections items
- time-to-finalize and reopen rates

### Testing strategy

- Unit tests:
  - billing status computation/mapping
  - consolidation detection logic
  - enrichment suggestion generation
- Integration tests (DB-backed):
  - end-to-end deposit import → match → flex/chargeback → finalize
  - dispute/collections flagging and report filters
  - consolidation idempotency and invariants

### Operational safety

- Strong idempotency keys for destructive/structural actions (consolidation, schedule creation).
- Migration/backfill scripts validated against a copy of production-like data.

## Suggested delivery order (pragmatic)

If alignment is the goal but risk must be controlled:

1) Phase 0 (decisions)  
2) Phase 1 (Billing Status + Collections + disputes schema)  
3) Phase 7 (Reports) — gives immediate operational value  
4) Phase 3 (Flex child linkage + rename/assign UX)  
5) Phase 4 (Chargeback alignment)  
6) Phase 2 (variance semantics refinements)  
7) Phase 5 (structural consolidation) — highest risk, largest change  
8) Phase 6 (metadata propagation) — governance-heavy, long-term payoff
