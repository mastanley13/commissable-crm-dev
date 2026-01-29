# Ticket Checklist — Flex + Chargeback Handling (Spec/Acceptance Criteria)

Date: 2026-01-29  
Scope source of truth:
- `docs/plans/billing-status-settlement-and-flex-resolution-implementation-plan.md`
- `docs/plans/reconciliation-system-alignment-plan.md`
- `docs/guides/reconciliation-system-comparison.md`
- `Reconciliation System.docx.md`

## Assumptions / Decisions (not tickets)

- Chargebacks are always `billingStatus = In Dispute` on creation (no “Pending” billing status).
- Chargebacks may have an approval gate, but approval does **not** auto-clear `billingStatus`.
- FLEX resolves via explicit resolution type + required reason: `ApplyToExisting | ConvertToPermanent | AcceptAsOneTime`.
- Base/parent dispute clears only under the defined conditional rule (apply-to-existing + no remaining disputed flex children + not disputed for other reasons).

## Epics

1) Schema + migrations (settlement adjustments, flex resolution metadata, chargeback metadata)
2) API behavior (settlement, flex resolve, chargeback approval semantics, reversal linkage)
3) UI workflow (Flex Review resolve UX, chargeback UX, schedule detail affordances)
4) Auditing (billing status change helper + approval events)
5) Apply-to-future safety (scope guards)
6) Validation + reporting (side-by-side mismatch report)
7) Tests (unit + DB-backed integration)

---

## Tickets (Checklist)

### Epic 1 — Schema + Migrations

- [ ] **SCH-001 — Add expected commission adjustment support**
  - **Goal:** Support settlement without overwriting contractual `expectedCommission`.
  - **Acceptance:**
    - Schema has a canonical field or mechanism equivalent to `expectedCommissionAdjustment`.
    - All expected-vs-actual variance math can drive “Expected Net = Actual Net” via adjustments.

- [ ] **SCH-002 — Add settlement metadata + adjustment records (recommended table approach)**
  - **Goal:** Make settlements auditable/reportable and reversible by record.
  - **Acceptance:**
    - A settlement/adjustment record persists: type (`ACCEPT_ACTUAL_AS_EXPECTED | WRITE_OFF | MANUAL_CORRECTION`), deltas, reason, approver, timestamps.
    - Revenue schedule baselines are preserved (no overwriting `expectedUsage` / `expectedCommission`).

- [ ] **SCH-003 — Add flex resolution metadata**
  - **Goal:** Persist flex resolution outcomes for audit, reporting, and conditional clearing rules.
  - **Acceptance:**
    - Flex schedule stores: `flexResolutionType`, `flexResolutionReason`, `flexResolvedById`, `flexResolvedAt`, and (nullable) `flexResolvedToRevenueScheduleId`.

- [ ] **SCH-004 — Ensure chargeback approval + reversal linkage is persisted**
  - **Goal:** Keep approval state separate from Billing Status; support chargeback reversal traceability.
  - **Acceptance:**
    - Chargeback has an approval state (e.g., `Pending/Approved/Rejected`) and approval metadata fields.
    - Reversal schedules (or equivalent entities) can point to the original chargeback schedule (e.g., `chargebackReversalOfRevenueScheduleId`).

### Epic 2 — API Behavior

- [ ] **API-SET-001 — Settlement endpoint uses adjustments (no baseline overwrite)**
  - **Endpoint:** `POST /api/revenue-schedules/:id/settlement`
  - **Acceptance:**
    - Computes deltas from Expected vs Actual and writes them as adjustments/settlement record(s).
    - Sets `billingStatusSource=Settlement` and clears dispute only via this explicit action (with required reason).
    - Emits a single auditable change entry (before/after + metadata).

- [ ] **API-FLEX-001 — Flex resolve endpoint (three resolution types)**
  - **Endpoint (preferred):** `POST /api/flex-review/:flexReviewItemId/resolve`
  - **Acceptance:**
    - Requires `resolutionType` + `reason`; supports `applyToFuture` (default false).
    - `ApplyToExisting` requires `targetRevenueScheduleId`.
    - Clears the flex schedule dispute on resolve; base/parent dispute clears only when rules are satisfied.
    - Audits all touched schedules (flex + any base changes).

- [ ] **API-CB-001 — Chargeback approval does not auto-clear billing status**
  - **Where:** existing chargeback approval flow (Flex Review “Approve & Apply” or equivalent).
  - **Acceptance:**
    - Approval updates approval state and any allocation state as designed, but keeps `billingStatus=In Dispute`.
    - Emits an explicit “ApproveChargeback” audit event even if Billing Status does not change.

- [ ] **API-CB-002 — Chargeback reversal creation/linking**
  - **Acceptance:**
    - Reversal creation links to the original chargeback schedule.
    - Reversal is visible/reportable in the chargeback’s “dispute story” and never silently clears the dispute.

### Epic 3 — UI Workflow

- [ ] **UI-FLEX-001 — Flex Review “Resolve” modal**
  - **Acceptance:**
    - Modal includes: resolution type selector, required reason, and (for ApplyToExisting) a target schedule picker.
    - Calls the flex resolve endpoint and updates the queue immediately (item leaves operational queue on success).

- [ ] **UI-FLEX-002 — Revenue Schedule detail “Resolve Flex” action (secondary entry)**
  - **Acceptance:**
    - Available only for flex-classified schedules.
    - Uses the same API and captures the same required fields.

- [ ] **UI-CB-001 — Chargeback display: dispute vs approval state**
  - **Acceptance:**
    - Chargeback items show Billing Status = `In Dispute` consistently.
    - Approval state is visible separately (e.g., “Pending Approval / Approved / Rejected”).

- [ ] **UI-CB-002 — Chargeback reversal visibility**
  - **Acceptance:**
    - UI exposes reversal linkage (e.g., “Reversal of Chargeback #…”) for traceability.

### Epic 4 — Auditing

- [ ] **AUD-001 — Standardize Billing Status change auditing**
  - **Acceptance:**
    - Helper emits a consistent “BillingStatusChanged” audit payload for every Billing Status transition.
    - Includes trigger enum values covering settlement, flex resolve, finalize/unfinalize, auto-recompute, etc.

- [ ] **AUD-002 — Add explicit audit event for chargeback approval**
  - **Acceptance:**
    - Approval emits an audit event even when Billing Status remains unchanged.

### Epic 5 — Apply-To-Future Safety

- [ ] **SAFE-001 — Enforce apply-to-future default-off and scope guards**
  - **Acceptance:**
    - Default is “this schedule only”; forward propagation requires explicit user intent.
    - Guardrails prevent unrelated schedules (and already-finalized periods) from being mutated.

### Epic 6 — Validation + Reporting

- [ ] **VAL-001 — Side-by-side mismatch report (legacy dispute vs Billing Status)**
  - **Acceptance:**
    - Outputs counts and mismatch samples, highlights “chargeback pending” legacy cases distinctly.
    - Can be run safely (script or admin-only endpoint) and is tenant-scoped.

### Epic 7 — Tests

- [ ] **TEST-SET-001 — Settlement math + invariants**
  - **Acceptance:**
    - Unit tests prove deltas bring Expected Net to Actual Net via adjustments.
    - Tests assert baseline expected fields are not overwritten.

- [ ] **TEST-FLEX-001 — Base dispute clearing rules**
  - **Acceptance:**
    - Integration tests cover: resolve flex clears flex dispute; base clears only when last disputed child and resolution type qualifies.

- [ ] **TEST-CB-001 — Chargeback approval keeps billing status in dispute**
  - **Acceptance:**
    - Integration tests assert: approval does not change Billing Status; emits “ApproveChargeback” audit event.

- [ ] **TEST-SAFE-001 — Apply-to-future scope boundaries**
  - **Acceptance:**
    - Tests prove no unrelated schedules change when apply-to-future is false; only in-scope schedules change when true.

