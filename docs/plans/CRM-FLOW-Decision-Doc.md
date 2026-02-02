According to a document from **January 22, 2026**, we have two tightly-coupled items to execute:

* **CRM-FLOW-001**: draft/implement the **bundle/split logic spec** (workflows \+ rules) covering **1:M, M:1, M:M** and what undo should do.  
* **CRM-MATCH-002**: build the **match-type validation wizard** that detects 1:M / M:1 / M:M and routes the user into the correct guided flow (with progress indicators), blocking invalid submissions.

Below is a comprehensive, implementation-ready plan that **locks CRM-FLOW-001 decisions first** (to avoid thrash) while still allowing us to start **CRM-MATCH-002 scaffolding immediately**.

Note: `docs/plans/CRM-FLOW-001_CRM-MATCH-002-Guide.md` is the repo-specific execution plan (UI/API/schema tasks). Use this document to lock decisions + examples; use the guide to translate decisions into implementation work.

---

## Progress note (2026-02-02)

### Shipped in this repo (2026-02-02)

- **CRM‑FLOW‑001 shipped**: atomic match-group apply/undo, M:M defaults, and Bundle / Rip-and-Replace endpoints (plus wizard integration).
- **CRM‑MATCH‑002 shipped**: match-type selection classifier + guided Match Wizard (1:M, M:1, M:M) with Preview → Apply flow.
- **CRM‑MATCH‑003 shipped**: comma-separated ID + product-alias parsing (case-insensitive match, preserve casing), admin edits, and reversible auto-fill via audit history undo.

### Key implementation touchpoints

- Match type detection: `lib/matching/match-selection.ts`
- Wizard UI: `components/reconciliation-match-wizard-modal.tsx`
- Match-group APIs:
  - `POST /api/reconciliation/deposits/:depositId/matches/preview`
  - `POST /api/reconciliation/deposits/:depositId/matches/apply`
  - `POST /api/reconciliation/deposits/:depositId/matches/:matchGroupId/undo`
- Bundle APIs:
  - `POST /api/reconciliation/deposits/:depositId/bundle-rip-replace/apply`
  - `POST /api/reconciliation/deposits/:depositId/bundle-rip-replace/:bundleAuditLogId/undo`

### Known gaps / decisions still open

- **Negative lines in bundle / multi-match wizard**: not supported yet (use Flex/chargeback flow).
- **Wizard Flex remainder creation** (leftover → create Flex schedule) is not implemented yet.
- **Role-gating** (Accounting unmatch vs Manager undo) is still a decision to lock; endpoints are currently permissioned by `reconciliation.manage`.
- **Bundle idempotency**: rerunning bundle can create duplicates (no idempotency key / operation table yet).

### QA / how to test

- Manual UAT checklist is captured in `docs/CRM‑FLOW‑001 — Bundle _ Split Rules Spec (1_M, M_1, M_M) + Undo_Unmatch.md` (see “13) How to test”).
- Automated tests: `npm test` (includes an M:M FIFO default allocation unit test).

## **0\) Ground truth constraints we must design around**

### **Current reconciliation state model and "apply vs finalize"**

The spec describes a 2-step concept:

1. **Apply / settle** at the line level:  
* On approval, write **Actual Usage** and **Actual Commission** to the revenue schedule, compute variance, and mark the line **Settled**.  
* Under/over-payment handling exists (Underpaid / Flex).  
2. **Finalize batch / reconcile deposit** at the deposit level:  
* "When all lines are allocated/flagged, submit batch; Deposit -> Reconciled; present summary and exceptions."

This distinction is key for defining "finalized/applied" semantics for undo.

### **Variance / exact-match expectations (and an identified conflict to resolve)**

We have two potentially conflicting references:

* Exhaustive workflow: Pass A requires amount within **variance threshold (default 0.00%)**, configurable per distributor/vendor.  
* Milestone 3 spec: matching rules mention **+/-5% for auto-match** and **+/-10% for fuzzy**.

**We must explicitly pick which is "default" for manual match validation vs auto-match suggestions** in CRM-FLOW-001, otherwise MATCH-002 will thrash.

### **Undo expectation**

Undo is explicitly described as a privileged action:

* "Undo: **Manager** can revert a match; restore states; audit persists."

### **Workbench entry point is consistent with "top lines / bottom schedules"**

The reconciliation UI is designed as a workbench with deposit lines on top and schedules below, with selection controls in both tables.  
And multi-select is explicitly called out as needed for multi-line workflows.

---

## **1\) CRM-FLOW-001 decision lock package (what we must finalize before "real logic")**

CRM-FLOW-001's own acceptance criteria demands we write the workflows/rules and cover 1:M, M:1, M:M with concrete examples.

### **Deliverable: a single "FLOW-001 Decision Doc" with these sections**

1. **Definitions**  
* What is a "match" (data representation)  
* What "apply" means vs what "finalize" means (and what becomes immutable at each stage)  
* What "unmatch" means vs what "undo" means (if we separate them)  
2. **Allocation invariants (hard rules)**  
* Allocation sum rules (deposit-side conservation)  
* Rounding/tolerance rules (pennies)  
* Partial allocation allowed? (and where)  
* Negative lines / chargebacks constraints  
3. **Workflow per match type**  
* 1:1, 1:M, M:1, M:M  
* Including required UI steps and backend side effects  
4. **Undo/unmatch semantics**  
* Exactly what fields/rows revert  
* How we handle propagated metadata  
* What happens if downstream actions occurred after apply/finalize

---

## **2\) 8 concrete examples to lock CRM-FLOW-001 (covers 1:M, M:1, M:M, undo/unmatch)**

These examples are written so an engineer can turn them into fixture-based tests.

### **Example 1 - 1:1 Perfect match (auto-apply eligible)**

**Setup (from spec scenario A)**

* Revenue Schedule expected commission $120, deposit line commission $120, high confidence.  
* System auto-applies and marks schedule reconciled.

**Apply effects**

* Create match record (see "data model" section below)  
* RS: Actual Commission \= 120; Status \= Reconciled (Closed if balance $0)  
* Line: Settled (then Reconciled at deposit finalize)

**Undo effects (manager)**

* Remove allocation/match  
* RS Actuals revert (or recompute from remaining allocations), status reverts  
* Line reverts to Unmatched/Suggested  
* Audit entry persists with reason

---

### **Example 2 - 1:M Split allocation (prepayment across 12 schedules)**

**Setup (from spec scenario B)**

* One deposit line: $1,440 for 12-month prepayment  
* 12 monthly revenue schedules of $120 each  
* User confirms allocation $120 to each schedule; system validates totals and reconciles all 12\.

**Apply effects**

* Create 12 allocation rows linked to one deposit line  
* Deposit line becomes Settled after allocation applied (then Reconciled at deposit finalize)  
* All 12 schedules updated and marked Reconciled (Closed if balance $0)

**Undo effects**

* Undo must be able to revert **all 12 allocations as a group** (this is why we need a "match\_group\_id" concept; see below)  
* Schedules revert to pre-apply state

---

### **Example 3 - M:1 FIFO partial payments (multiple deposits fund one schedule)**

**Setup (from spec scenario C)**

* One schedule expects $120  
* Three deposit lines: $50, $30, $40 applied FIFO  
* After first: schedule Partially Paid, balance $70  
* After second: schedule Partially Paid, balance $40  
* After third: schedule Reconciled.

**Apply effects**

* Each deposit line gets its own allocation row to the same schedule  
* Schedule actuals are incremental (or computed sum), status transitions as above  
* This aligns with: "multiple deposits may be applied in FIFO until fully reconciled and closed."

**Undo effects**

* Undoing the *second* allocation should:  
  * Recompute schedule actuals/balance  
  * Potentially change status back to Partially Paid with different balance  
  * Not destroy the other two allocations

This implies undo must be **allocation-aware**, not just "clear matched\_schedule\_id".

---

### **Example 4 - 1:1 overpayment -> FLEX schedule created for the overage**

**Setup (from spec scenario D)**

* Expected commission $120  
* Deposit line commission $150  
* System applies $120 to original schedule and creates Flex for $30, both settled.

**Apply effects**

* Allocation \#1: deposit -> original RS for $120  
* Allocation \#2: deposit -> newly created Flex RS ("-F") for $30  
  (Naming convention described)  
* Admin notified / Flex tracker (per workflow)

**Undo effects**

* Undo should reverse:  
  * The applied $120 to original RS  
  * The created Flex RS **if and only if** it has no other allocations/edits (recommended rule; **ASSUMED** because deletion semantics aren't explicitly defined in the docs)

---

### **Example 5 - M:1 "Rip & Replace" bundle workflow (many lines -> one schedule trigger)**

**Setup (from Jan 21 meeting summary)**

* Problem: one service is billed as three separate line items; monthly manual workaround is painful  
* Trigger: user selects **multiple deposit line items \+ a single revenue schedule**  
* System asks to create a bundle and **replaces the product's remaining schedules** with a new set that mirrors the deposit line items (so future matches become automatic).

**Apply effects (proposed flow that FLOW-001 must lock)**

* Create bundle definition (new products/schedules) for remaining term  
* Re-point future schedules, preserve audit/precedence (spec references supersede/precedence in acceptance tests)  
* Then match each deposit line to the corresponding new schedule(s)

**Undo effects (decision needed)**

* Undoing the match **must not silently delete** the newly created schedules if they already have downstream activity  
* Recommended: bundle creation is a **separate reversible operation** with its own audit \+ rollback rules (**ASSUMED**, because the meeting summary states the idea but not rollback rules)

This is the single biggest "thrash risk" if not decided up front.

---

### **Example 6 - Negative line item (chargeback) \+ reversal**

**Setup (from spec scenario E)**

* Month 3 schedule was reconciled  
* Month 4 deposit contains a **negative line (-$120)** representing a chargeback  
* System creates "-CB" schedule; later creates "-CB-REV" when reversed.

**Constraints**

* "Negative amounts \= chargebacks" is a critical business rule.  
* Chargebacks and reversals should always be shown for audit.

**Undo effects**

* Undoing chargeback match should restore original schedule status/actuals and mark CB schedule as unmatched/unallocated (or remove if newly created and unused) (**ASSUMED** on deletion)

---

### **Example 7 - Unknown product -> FLEX placeholder; later rename/convert**

**Setup (from spec scenario F \+ meeting clarifier)**

* Deposit line includes unknown product "ADI Service Bonus"  
* System creates FLEX schedule and flags for review.  
* Meeting requirement: user must be able to rename a Flex Product after research, converting it into a permanent product.

**Undo effects**

* Undo of the original allocation should not destroy the knowledge work (rename/convert) if it's already been performed (**ASSUMED**, needs explicit FLOW-001 rule)

---

### **Example 8 - M:M (matrix allocation across multiple lines and multiple schedules)**

No document gives an explicit M:M worked example, but CRM-MATCH-002 explicitly requires supporting M:M detection and flow.

**ASSUMED example (to be confirmed in FLOW-001)**

* Deposit lines:  
  * L1: $300 "Fiber - Location A"  
  * L2: $200 "Fiber - Location B"  
* Revenue schedules:  
  * S1: $250 "Fiber A - Jan"  
  * S2: $50 "Fiber A - Feb"  
  * S3: $200 "Fiber B - Jan"  
* Allocation matrix:  
  * L1 -> S1 $250, L1 -> S2 $50  
  * L2 -> S3 $200

**Why we include it now**

* It drives the wizard UX (allocation grid), validation rules, and backend data model.

**Undo effects**

* Undo must revert allocations group-wise (match\_group), recompute schedule actuals and balances.

---

## **3\) Allocation invariants to lock (FLOW-001)**

These are the "don't let engineers interpret" rules.

### **3.1 Deposit-side conservation rules (must hold)**

From the UI spec, deposit lines have explicit allocated/unallocated tracking (implies partial allocation tracking is real).

**Proposed invariants (marking assumptions where needed):**

1. For each deposit line:  
* `usage_allocated + usage_unallocated = actual_usage` (to the penny) (**ASSUMED** but strongly implied by "Usage Allocated/Unallocated" columns)  
* same for commission  
2. A deposit can be finalized only when all lines are allocated/flagged (per finalize-batch rule).

### **3.2 Exact-match vs partial match**

* Partial payments are explicitly supported (RS Partially Paid/Underpaid).  
* Overpayments create Flex schedules.

**Decision to lock:**

* Are we enforcing "exactness" only as: *allocated totals must equal the deposit line totals* (recommended), while allowing schedule balances to be non-zero?  
  This aligns with underpaid/overpaid handling.

### **3.3 Rounding / tolerance**

* Money calculations must be correct "to the penny".

**Decision to lock:**

* Default rounding: banker's rounding? standard round-half-up?  
  (**ASSUMED**: choose standard round-half-up unless finance says otherwise)

**Decision to lock:**

* Manual validation tolerance: $0.01? $0.00?  
  (Conflict noted earlier: 0.00% vs +/-5/+/-10; this must be resolved.)

### **3.4 Negative lines / chargebacks constraints**

* Negative deposit lines should generate chargeback schedules (-CB) and reversals (-CB-REV).

**Decisions to lock:**

* Do we allow negative lines to be split across multiple schedules (1:M)?  
  (**ASSUMED** recommendation: disallow split for negative lines unless explicitly enabled; require manager approval)

---

## **4\) Entry point confirmation for MATCH-002 wizard**

From the workbench UI and ticketing:

* Multi-select on reconciliation page is required for multi-line workflows.  
* UI is explicitly a **top Deposit Line Items table** and **bottom Revenue Schedules (Suggested Matches) table**, each with selection controls.

**Decision lock statement (recommended to adopt):**

* Wizard launches from **Reconciliation Workbench / Deposit Detail-style screen** where:  
  * user multi-selects deposit lines (top grid) and optionally selects target schedules (bottom grid),  
  * then clicks **Match** (bulk action).

This aligns with the "rip & replace" trigger: multiple deposit lines \+ single schedule.

---

## **5\) Data/API clarity: what represents a "match" today (and how to extend without parallel systems)**

### **What exists in current schema docs**

The Workflow Overview doc shows `deposit_line_items` includes a **single `matched_schedule_id`** (suggesting today's match is 1:1 at the schema level).

It also includes a `reconciliation_audit_log` keyed by deposit line \+ schedule \+ action (MATCH / UNDO).

### **Why this is insufficient for 1:M and M:M**

* A single `matched_schedule_id` cannot represent one line matched across multiple schedules, or many-to-many allocations.

### **Recommended approach (to avoid a parallel system)**

Implement a **canonical allocations model** and treat everything (auto-match, manual-match, bundle/split, FIFO, flex) as operations that create/update allocations.

Repo mapping: this codebase already has an allocations table (`DepositLineMatch`) that supports 1:M / M:1 / M:M. The primary gap for FLOW-001 / MATCH-002 is a **match-group concept** so multi-allocation actions can be previewed/applied/undone as a single unit.

**Repo-aligned schema recommendation (implementation-ready):**

* `DepositMatchGroup` (new)  
  * `id`, `tenantId`, `depositId`, `matchType` (1:1 / 1:M / M:1 / M:M), `status` (Previewed/Applied/Undone), `createdByUserId`, `createdAt`, optional `undoReason`, `undoneByUserId`, `undoneAt`
* `DepositLineMatch.matchGroupId` (new nullable FK/index)  
  * `DepositLineMatch` remains the canonical allocations table: (`depositLineItemId`, `revenueScheduleId`, `usageAmount`, `commissionAmount`, `status`, `source`, ...)

**Compatibility bridge (if the spec/UI wants a "primary schedule"):**

* If a display-only `matched_schedule_id` concept exists, treat it as derived/optional for true 1:1 UX convenience, but **all financial truth comes from `DepositLineMatch`**.

**Why this aligns with specs**

* The UI expects allocated/unallocated fields.  
* Undo is described as restoring state; allocations \+ match\_group give us precise reversibility.

---

## **6\) CRM-MATCH-002 execution plan (start now, but "real allocation logic" waits for FLOW-001 lock)**

CRM-MATCH-002 acceptance criteria is focused on **detecting match type** and guiding the user through the correct steps with progress indicators, blocking invalid submissions.

### **6.1 Match-type classifier (pure front-end \+ simple backend validation)**

**Inputs**

* `selectedDepositLineIds[]`  
* `selectedRevenueScheduleIds[]` (optional depending on flow)

**Classification**

* (1,1) -> 1:1  
* (1, N) -> 1:M  
* (M,1) -> M:1  
* (M, N) -> M:M  
* invalid combos (0 selected) blocked with actionable errors

**This is safe to build now** because it doesn't depend on final allocation math-only on selections.

### **6.2 Wizard shell \+ step framework (safe to build now)**

Build a single wizard component that:

* Shows **match type**, selection summary  
* Shows step progress (as required)  
* Has a standard "Preview -> Apply" flow (buttons wired, but preview payload can be stubbed until FLOW-001 is locked)

**Proposed step skeleton**

* Step 1: Confirm selection \+ match-type explanation  
* Step 2: Allocation method / matrix input (varies by match type)  
* Step 3: Preview changes (computed deltas)  
* Step 4: Apply \+ confirmation

### **6.3 Type-specific UX requirements**

**1:1**

* Simple confirmation \+ preview of exact deltas

**1:M**

* List of candidate schedules (chronological; aligns with split scenario)  
* Allocation editor: equal split / proportional / manual

**M:1**

* FIFO toggle (if same product across schedules FIFO is used automatically in matching engine)  
* Include "Rip & Replace bundle" option when the trigger pattern matches (multiple lines \+ single schedule)

**M:M**

* Allocation grid (matrix) \+ validation summary  
  (This is where FLOW-001 decisions matter most, but the UI shell can be built.)

---

## **7\) Undo / Unmatch semantics (define now; implement after allocations data model is chosen)**

### **7.1 Proposed semantics to lock in FLOW-001**

**Apply (line-level settlement)**

* Creates match\_group \+ allocations  
* Updates RS actuals/variance and line status to Settled

**Finalize (deposit-level reconcile)**

* Deposit -> Reconciled only when all lines allocated/flagged

**Undo (manager)**

* Reverts a previously applied match  
* Restores pre-match state; audit persists

**Unmatch (non-manager?)**

* The Milestone 3 spec says Accounting can "match/unmatch items"  
  But the exhaustive workflow calls out undo as manager-only.

NOTE: **Conflict to resolve in FLOW-001**: who can unmatch/undo.

### **7.2 Engineering recommendation (ASSUMED but robust)**

* **Unmatch**: allowed for Accounting *before deposit finalize* (reverts allocations in a match\_group not yet finalized)  
* **Undo**: Manager/Admin action that can revert even after finalize (with reason, audit)

---

## **8\) Phased roadmap with dependencies**

### **NOW - Lock FLOW-001 decisions \+ build MATCH-002 scaffolding**

**A. CRM-FLOW-001 (Decision lock)**

* Produce the Decision Doc with the 8 examples above  
* Explicitly decide:  
  * tolerance defaults (0.00% vs +/-5/+/-10) and where each applies  
  * partial allocation rules (line vs schedule)  
  * negative-line constraints (chargebacks)  
  * rip & replace rollback semantics (bundle creation reversibility)

**B. CRM-MATCH-002 (Start immediately)**

* Implement classifier \+ wizard shell  
* Stub preview/apply API calls behind a feature flag  
* Wire up invalid-selection blocking and progress indicators

**Dependencies**

* Multi-select must exist (CRM-REC-001)  
* Bottom grid responsiveness (CRM-REC-006) to make schedule selection sane

---

### **NEXT - Implement allocation engine \+ canonical data model**

**C. Data model alignment**

* Choose allocations table approach (recommended above)  
* Migrate/bridge from `matched_schedule_id` representation if needed

**D. Build match preview \+ apply**

* `POST /match/preview` returns:  
  * allocations to be created  
  * RS deltas (actuals/variance/status)  
  * line deltas (allocated/unallocated/status)  
  * any flex/CB schedules to be created  
* `POST /match/apply` performs atomic write and logs audit (aligns with audit requirement)

---

### **LATER - Undo/unmatch hardening \+ bundle lifecycle \+ regression suite**

**E. Undo/unmatch**

* Implement manager-only undo (with reason) per exhaustive workflow  
* Ensure group undo for 1:M and M:M (match\_group)

**F. Rip & replace bundle**

* Finalize Rob's detailed bundle spec (explicit next step assigned)  
* Implement reversible bundle creation rules

**G. Test harness**

* Turn Examples 1-8 into automated integration tests

---

## **9\) What's still "ASSUMED" (so we don't accidentally bake in the wrong behavior)**

1. **Allocation data model**: this repo already has canonical allocations via `DepositLineMatch`. The remaining assumed work is a **match-group concept** so multi-allocation apply/undo is atomic and auditable.  
2. **Undo deletion rules** for newly created Flex/CB schedules are not specified; recommended conditional deletion is assumed.  
3. **Unmatch vs undo roles** conflict between "Accounting can unmatch" vs "Undo is manager-only" and must be resolved.

---

If you want, I can also convert the **8 examples** into a **single-page FLOW-001 "test vector table"** (inputs -> expected allocations -> expected statuses -> undo result) so engineering can implement it as fixtures with almost no interpretation.
