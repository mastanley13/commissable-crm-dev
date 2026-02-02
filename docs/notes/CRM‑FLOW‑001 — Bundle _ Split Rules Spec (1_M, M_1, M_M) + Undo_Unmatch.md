# **CRM‑FLOW‑001 — Bundle / Split Rules Spec (1:M, M:1, M:M) \+ Undo/Unmatch**

This document is intended to be handed directly to a coding agent. It consolidates the *current source‑of‑truth requirements* for complex reconciliation matching flows (“split”, “partial payments”, and “bundle/rip‑and‑replace”), plus the required undo/unmatch semantics. The sprint plan explicitly requires this spec to include **≥5 concrete examples** spanning **1:M, M:1, M:M \+ undo/unmatch rules**.

Sources used: Commissable reconciliation workflow guide, the exhaustive reconciliation SOW/workflow, Milestone 3 reconciliation specs, and the January 21 & January 22 meeting transcript notes with Rob Hootselle.

---

## **0\) Why this exists (and what “done” means)**

### **Goal**

Enable the system to **detect match type** (1:1 vs 1:M vs M:1 vs M:M) and drive users through the correct **wizard/validation** before applying allocations—so reconciliation can handle non‑1:1 exceptions without fragile manual clicking. This “identify match type → trigger workflow wizard → learn from user action” pattern is explicitly called out as a top priority.

### **Minimum acceptance for this ticket (CRM‑FLOW‑001)**

* A written, implementable rules spec for:  
  * **Split allocation (1:M)**  
  * **Partial payment / many deposits to one schedule (M:1)**  
  * **Many-to-many (M:M) allocation rules**  
  * **Undo/unmatch** semantics for all above  
* Include **≥5 concrete examples** demonstrating expected behavior and edge cases.

Note: Sprint planning suggests MVP order: **1:M \+ M:1 first, M:M next**; this spec covers all three, but flags implementation phasing where appropriate.

---

## **0.1\) Implementation status (as of 2026-02-02)**

This spec has now been **implemented** in the reconciliation workbench with a guided wizard + atomic match-group apply/undo.

### ✅ Implemented (CRM‑FLOW‑001 + CRM‑MATCH‑002)

* **Match-type detection + routing** (1:1 vs 1:M vs M:1 vs M:M) is live via `classifyMatchSelection()` and drives whether the system:
  * applies immediately (1:1), or
  * interrupts into the Match Wizard (non‑1:1).
* **Match Wizard UI** (Selection → Allocation → Preview → Apply) supports:
  * **1:M Split allocation wizard**
  * **M:1 allocation wizard**
  * **M:M allocation wizard** (matrix entry)
  * **M:1 Bundle branch** (“Rip & Replace”) that creates new products/schedules, then switches into M:M allocation for the newly-created schedules.
* **Atomic match-group concept** is implemented:
  * `DepositMatchGroup` groups allocations (rows in `DepositLineMatch`) so apply/undo is atomic and auditable.
  * Endpoints:
    * `POST /api/reconciliation/deposits/:depositId/matches/preview`
    * `POST /api/reconciliation/deposits/:depositId/matches/apply`
    * `POST /api/reconciliation/deposits/:depositId/matches/:matchGroupId/undo`
* **M:M default allocation proposal** is implemented (FIFO/greedy fill across schedules) and used both server-side (preview defaults) and in the wizard UI.
* **Undo/unmatch completeness**:
  * “Unmatch” still exists for line-level removal of allocations.
  * “Undo match group” reverts all allocations created by the group, recomputes lines/schedules/deposit, and writes audit logs.
  * Auto-fill side effects are recorded and **best-effort undone** during match-group undo via `undoAutoFillAuditLog()`.
* **Bundle / Rip-and-Replace** endpoints are implemented:
  * `POST /api/reconciliation/deposits/:depositId/bundle-rip-replace/apply`
  * `POST /api/reconciliation/deposits/:depositId/bundle-rip-replace/:bundleAuditLogId/undo`

### ⚠️ Current limitations / follow-ups

* **Negative deposit lines are not supported** in:
  * the multi-match wizard flows (preview blocks with a chargeback guidance error), and
  * the bundle rip/replace flow (apply rejects).
* **Flex remainder creation inside the wizard** (the “leftover → create Flex” prompt described in examples) is not implemented yet.
* **Role-gating remains a decision**: endpoints are currently permissioned by `reconciliation.manage`; the spec’s manager-only undo vs accounting unmatch distinction still needs to be locked.
* **Bundle idempotency**: rerunning bundle can create duplicates (no idempotency key / operation table yet).

## **1\) Key terms (domain objects)**

Use these canonical definitions:

* **Deposit**: header record representing an incoming payment batch; **sum of deposit line items must equal deposit amount**.  
* **Deposit Line Item**: one row from vendor/distributor file with match fields and amounts.  
* **Revenue Schedule (RS)**: expected usage/commission event (often monthly). After reconciliation, RS is closed to further deposits unless reopened by admin.  
* **FIFO rule**: When candidates are the same product across schedules, apply **oldest schedules first** (FIFO).  
* **Flex schedule**: created to capture overage when deposit \> expected; tagged “-F”.  
* **Unmatch/Undo**: reversal of allocations; “Manager-level Undo restores pre-match states for both Deposit Line and Revenue Schedule” and requires a full audit log.

---

## **2\) Core reconciliation state model (important for Undo/Unmatch)**

The reconciliation workflow explicitly has a **two-stage concept**:

1. **Line-level settlement**: when a deposit line is approved/allocated, it becomes “Settled”.  
2. **Batch finalize**: when all lines are allocated/flagged, submit batch; deposit becomes “Reconciled.”

Milestone specs require:

* Reconciliation actions (Accept/Reject/Modify/**Split**/FLEX/Skip) must work.  
* **Batch Finalize updates schedules & deposits atomically**.  
* “Cannot modify reconciled items” \+ “Audit trail for every change.”

**Implication for unmatch/undo:**

* “Unmatch” should be allowed at least while items are *Settled* but not batch‑finalized.  
* After batch finalize (deposit “Reconciled”), **Undo** may require elevated role and must restore pre‑match states with audit.

**ASSUMED:** Exact state names in the current codebase may differ, but behavior should conform to the “settle then finalize” model above. (Reason: the workflow documents describe the behavior, not your enum values.)

---

## **3\) Match-type detection (precondition to all complex flows)**

When user clicks **Match**, run a validation script to infer **which type of matching is being attempted**, and interrupt with a wizard when not 1:1. This is explicitly requested by Rob (example: “if two or more deposit line items are checked… once you click match it would interrupt… wizard”).

### **Detection input**

At click-time, capture:

* `selectedDepositLineIds[]`  
* `selectedRevenueScheduleIds[]`

### **Classification rules (deterministic)**

* **1:1** → `len(lines)=1` AND `len(schedules)=1`  
  * Apply immediately (no wizard), using normal apply flow.  
* **1:M (Split allocation)** → `len(lines)=1` AND `len(schedules)>1`  
  * Trigger **Split wizard** (see §4).  
* **M:1 (Many deposits to one schedule / bundle candidate)** → `len(lines)>1` AND `len(schedules)=1`  
  * Trigger **Many:1 wizard** (see §5).  
* **M:M** → `len(lines)>1` AND `len(schedules)>1`  
  * Trigger **M:M wizard** (see §6).

**ASSUMED:** If the current UI only supports selecting schedules after selecting a deposit line, still store both arrays and apply the same classification logic.

---

## **4\) 1:M — Split Allocation rules (single deposit line → multiple schedules)**

### **Source scenario: “Scenario B: Split Allocation (1:Many)”**

This is a defined scenario in the workflow guide: a single prepayment deposit line matches multiple future schedules; the system suggests the closest match but flags it; then user allocates across schedules in chronological order; validation ensures allocation doesn’t exceed deposit line amount; and all schedules can be reconciled simultaneously once allocations are correct.

### **Required system behavior**

**Trigger:** user attempts 1:M match (detected by selection counts).

**Wizard steps (minimum):**

1. **Explain the detected action:** “You are allocating 1 deposit line across N schedules.”  
2. **Show eligible schedules list** (the schedules user selected) in **chronological order** (oldest first).  
3. **Allocation UI**: allow setting an allocated amount per schedule.  
4. **Validation**:  
   * **Hard rule:** Sum(allocated) **cannot exceed** deposit line amount.  
   * **Soft rule / warning:** If Sum(allocated) \< deposit line amount, require user decision (see below).  
5. **Apply**:  
   * Write Actual Usage and Actual Commission to the impacted schedules; compute variance; mark line “Settled.”  
   * On finalize, schedules become reconciled as appropriate.

### **Leftover handling (Sum(allocated) \< deposit line amount)**

The workflow guide only states “cannot exceed.” It does not explicitly define “leftover.”

**ASSUMED (recommended, aligned with Flex/overage rules):**

* If user’s selected schedules don’t consume full deposit line amount, prompt:  
  * **Option A:** Create a Flex schedule for the remainder (tag “-F”).  
  * **Option B:** Leave remainder unallocated and keep deposit line unsettled (block finalize until resolved).

---

## **5\) M:1 — Many deposits/lines → one schedule (partial payment \+ “bundle” exception)**

There are **two distinct real-world needs** covered by the documents:

### **5.1 M:1 “Partial Payment Processing” (multiple deposits fund one schedule)**

**Scenario C** in the workflow guide defines partial payments: a revenue schedule expected $120, and multiple deposits ($50, $30, $40) get applied over time; the system matches in chronological order (FIFO), schedule is “partially paid” until the full expected amount is met, then reconciled.

**Required behavior:**

* System must support **multiple deposit line items linked to the same schedule**, with running totals visible (the Milestone spec includes “Reconciled Deposits: Shows all bank deposits matched to this schedule… running totals”).  
* Schedule remains **open/partially paid** until fully paid; then reconciled.

**FIFO rule (required):**

* Apply earlier deposits first; match engine says FIFO applies when same product across schedules; and Milestone calls out “Oldest unmatched schedules first.”

### **5.2 M:1 “Bundle / Rip-and-Replace” (one schedule currently represents multiple deposit line items)**

Jan 21 meeting notes describe a higher‑level workflow: when deposit lines represent multiple items but the system currently has one product/schedule, the system should ask if this is a **bundle** and offer to **split the product and its revenue schedules** so they match the deposit line items. It then creates new products \+ schedules and removes (or roll-ups) the old product, enabling future auto-matching.

**Required UX prompt (as described):**

* Pop-up wording conceptually like:  
  * “Is this a bundle? Do you want to split this product and its revenue schedules so that it matches the deposit line items?”

**Required behavior (bundle option):**

* Create multiple products to match the deposit line items and create revenue schedules for them; reconcile 1:1 after that; future deposits will auto-match because the system has learned the mapping.

**Open decision explicitly mentioned:**

* Remove old product+schedules **OR** convert old product into a roll-up where totals live.

**ASSUMED (implementation approach):** Bundle/rip-and-replace should be implemented as a separate wizard branch inside the M:1 wizard:

* Branch 1: “Apply as partial payment(s)” (pure allocation; no product reshaping)  
* Branch 2: “This is a bundle → split product/schedules to match deposit lines” (mutates opportunity product structure and schedules)

Reason: both behaviors are referenced, and they solve different problems.

---

## **6\) M:M — Many deposit lines → many schedules (allocation matrix)**

The Jan 22 meeting explicitly calls out the system must be able to identify **many‑to‑many** actions and handle them via a structured workflow/wizard (today, user can “do all of that” but system doesn’t recognize what it is).

However, the uploaded workflow documents do **not** include a dedicated M:M scenario narrative like Scenario B/C. So below is an implementable spec that is consistent with:

* existing **Split** action support,  
* FIFO prioritization,  
* “apply allocations \+ audit \+ undo” requirements.  
  (Where not explicitly stated, items are marked **ASSUMED**.)

### **M:M Wizard (minimum viable)**

**Trigger:** `len(lines)>1 && len(schedules)>1`

**Goal:** produce an **allocation plan** mapping `(depositLineId → revenueScheduleId → allocatedAmount)` such that:

* For each deposit line: Sum(allocated to schedules) ≤ deposit line amount  
* For each schedule: Sum(allocated from deposit lines) ≤ schedule remaining expected balance  
* Leftovers handled by: flex creation / remaining open balances (see below)

### **Required ordering & assistance**

* Default sorting:  
  * Schedules sorted **oldest first** (FIFO) when multiple schedules are involved.  
* If multiple candidates meet threshold, present ranked suggestions for user selection (matching ambiguity handling).

### **Allocation suggestions (ASSUMED)**

* Auto-propose allocations where:  
  * strong identifiers match (Account IDs, order IDs, SKU/product), consistent with hierarchy filters.  
  * then apply FIFO within the same product across schedule months.

### **Leftovers**

* If deposit line has leftover after allocations → prompt to create Flex schedule for remainder (overage) OR leave unallocated and keep unsettled.  
* If schedule is still underpaid after allocations → mark partially paid/underpaid and keep open (consistent with underpayment handling).

---

## **7\) Apply behavior (shared across 1:M, M:1, M:M)**

Once user confirms a wizard:

* On approval, write Actual Usage and Actual Commission; compute variance; mark line settled; append any new metadata; optionally propagate changes to future schedules; log audit entry (before/after \+ reason).  
* Finalize:  
  * When all lines allocated/flagged, submit batch; deposit → reconciled; present summary/exceptions.  
  * Batch finalize must update schedules and deposits **atomically**.

---

## **8\) Undo / Unmatch — required semantics**

Undo/unmatch is explicitly expected in meetings (“if you match something, then unmatch it, we should be good”).

The exhaustive workflow requires:

* “Manager-level Undo restores pre-match states for both Deposit Line and Revenue Schedule.”  
* “Full audit log of before/after values, actor, timestamp, and reason.”

Milestone specs also say:

* “Match/unmatch items” as part of Accounting access.  
* “Cannot modify reconciled items” \+ “audit trail for every change.”

### **Required behavior (functional)**

Undo/unmatch must be able to reverse, at minimum:

1. **Allocation link(s)** between deposit line(s) and schedule(s)  
2. **Schedule Actual Usage/Commission** updates written during apply (and recompute variance)  
3. **Status** changes on:  
   * deposit line item (e.g., settled → unmatched)  
   * revenue schedule (reconciled/partially paid → open/partially paid based on remaining allocations)  
   * deposit header (if used)  
4. **Propagated metadata changes** made “on approval” (append new metadata; propagate to future schedules).

**ASSUMED:** If metadata propagation can affect multiple future schedules, Undo must either (a) store an action-scope snapshot for rollback, or (b) store a per-field mutation log to revert only what the action changed.

### **Permissions (possible conflict)**

* Workflow says **manager-level** undo.  
* Milestone says **Accounting** can match/unmatch items.

**ASSUMED resolution:**  
Implement RBAC checks such that:

* “Unmatch” for *unfinalized/settled* items is available to Accounting.  
* “Undo” for *finalized/reconciled* items requires Manager/Admin.

(Flag this as a point to confirm, because the docs don’t explicitly reconcile the two.)

### **Audit requirements (hard)**

Every undo/unmatch must record:

* who, when, what  
* before/after values  
* reason (required field)

---

## **9\) Implementation requirements for coding agent (data \+ APIs)**

The exhaustive workflow describes core mechanics:

* Matching engine rules (exact \+ fuzzy \+ FIFO)  
* Apply & propagate (write actuals, append metadata, audit)  
* Undo (manager reverts match)

### **Allocation data model (ASSUMED but necessary)**

To support 1:M, M:1, and M:M, implement a canonical “allocation” concept:

**Allocation record fields (suggested):**

* `id`  
* `deposit_id`  
* `deposit_line_id`  
* `revenue_schedule_id`  
* `allocated_usage_amount`  
* `allocated_commission_amount`  
* `created_by`, `created_at`  
* `source` \= `auto|suggested|manual|wizard`  
* `wizard_type` \= `1M|M1|MM|bundle_rip_replace`

Reason this is necessary:

* The Milestone spec expects schedule detail to show all matched deposits with running totals.  
* The workflow explicitly supports split / FIFO apply actions and undo; those require a persistent link and reversible state.

### **Undo snapshot/mutation tracking (ASSUMED but required for “restore states”)**

Implement one of:

* **Option A:** `reconciliation_action_log` with JSON snapshots of affected rows (before/after)  
* **Option B:** per-row per-field mutation log (field propagation \+ reversals)

Must support “restore pre‑match states” across both deposit lines and schedules.

---

## **10\) Concrete examples (≥5)**

These examples are written as acceptance-test-style cases.

### **Example 1 — 1:M Split Allocation (prepayment across 12 schedules)**

* Deposit line: `$1,440`  
* Schedules: 12 schedules at `$120` each (monthly)  
  **Expected:** System detects 1:M and opens Split wizard; schedules ordered oldest→newest; allocate `$120` to each; validation passes; apply marks all 12 schedules reconciled simultaneously once allocations complete.

### **Example 2 — 1:M Split Allocation with leftover → Flex remainder (ASSUMED)**

* Deposit line: `$1,500`  
* Selected schedules total expected: `$1,440`  
  **Expected:** Validation prevents over-allocation; after allocating `$1,440`, wizard shows remainder `$60` and prompts to create Flex schedule “-F” for `$60` remainder OR leave unallocated (cannot finalize until resolved).  
  **Source alignment:** Flex exists for overage/unmatched exceptions.

### **Example 3 — M:1 Partial Payment (multiple deposits fund one schedule)**

Revenue schedule expected: `$120`.  
Deposits applied over time: `$50`, then `$30`, then `$40`.  
**Expected:** Each deposit line can match to the same schedule; schedule becomes partially paid until total hits `$120`, then reconciled; system tracks remaining balance; applies FIFO/chronological order.

### **Example 4 — M:1 Bundle / Rip-and-Replace (turn 3 deposit lines into 3 products+schedules)**

Scenario described in Jan 21 notes:

* One existing product/schedule currently represents what the deposit shows as **three separate line items** (e.g., product charge \+ negative charges/taxes).  
  **Expected flow:**  
1. User selects the schedule \+ the relevant multiple deposit lines and clicks Match.  
2. System detects M:1 and offers a **Bundle** branch: “split this product and its revenue schedules so that it matches the deposit line items.”  
3. System creates **three products** matching the deposit lines and creates revenue schedules for them; user reconciles 1:1 afterward; future deposits auto-match because the system learned the mapping.

**Open decision:** remove old product+schedules vs convert to roll-up totals.

### **Example 5 — M:M Allocation Matrix (ASSUMED but required by meeting intent)**

* Deposit lines: L1 `$100`, L2 `$50`  
* Schedules: S1 `$80` (older), S2 `$70` (newer)  
  **Expected:**  
* Wizard detects many-to-many and guides allocation  
* Default proposal (FIFO) allocates:  
  * L1→S1 `$80`, L1→S2 `$20`  
  * L2→S2 `$50`  
* S1 reconciled; S2 partially paid/reconciled depending on remaining expected.  
* Audit log records before/after and reason on apply.

### **Example 6 — Undo/unmatch of a split allocation (1:M)**

Given Example 1 was applied, user realizes 2 schedules were selected incorrectly.  
**Expected:**

* User clicks Unmatch/Undo on the allocation action.  
* System restores pre-match states for:  
  * deposit line  
  * all affected schedules (actuals \+ statuses)  
* Audit log persists (before/after \+ actor \+ reason).

### **Example 7 — Undo after batch finalize (role-gated) (ASSUMED)**

If the deposit was batch-finalized and is “Reconciled”:

* Non-manager cannot modify reconciled items.  
* Manager-level Undo can reopen/restore pre-match states (per workflow doc).

---

## **11\) Open questions / uncertainties (flag for confirmation)**

These are the specific unknowns blocking full implementation fidelity; everything else above is directly supported by docs.

1. **Bundle rip-and-replace end-state:** remove old product/schedules vs keep as roll-up totals.  
2. **Exact leftover behavior in 1:M and M:M:** when allocation sum \< deposit line amount, do we require Flex creation, or allow leaving remainder unallocated and block finalize? (Docs specify “cannot exceed” but not “must equal.”)  
3. **Permission model conflict:** Accounting can match/unmatch, but Undo is manager-level—confirm whether “unmatch” is always accounting-allowed, and whether “undo” is only for finalized items.  
4. **M:M details:** no dedicated scenario doc exists; confirm expected UX (matrix vs guided FIFO auto-plan with minor overrides). Meeting indicates it must be recognized and handled by wizard.  
5. **Propagation scope on undo:** if “append metadata and propagate to future schedules” ran, should undo revert propagation to all impacted future schedules automatically? Workflow implies yes (“restore states”), but the boundary is not stated.

---

## **12\) Delivery checklist for the coding agent**

The items below are now **implemented** (as of 2026-02-02):

1. ✅ **Match-type detection** on Match click; wizard invoked for non‑1:1.  
2. ✅ **1:M split allocation wizard** (chronological ordering + cannot exceed line totals).  
3. ✅ **M:1 wizard** (allocate multiple lines to one schedule) **and** Bundle (“Rip & Replace”) branch.  
4. ✅ **Undo/unmatch**:
   * line-level **Unmatch** (existing endpoint)
   * group-level **Undo match group** (atomic undo + audit)
5. ✅ **M:M wizard** + FIFO default proposal.

Remaining / follow-up work:

* ⬜ **Bundle negative-line support** (tax/tier/chargeback lines in the bundle scenario).
* ⬜ **Wizard → Flex remainder** creation flow (optional but referenced in examples).
* ⬜ **Permission model lock** (Accounting vs Manager responsibilities for unmatch/undo).
* ⬜ **Bundle idempotency** and “duplicate bundle” prevention.

---

## **13\) How to test (manual UAT checklist)**

### **Prereqs**

* Run the app: `npm run dev`
* Use a test user with permission `reconciliation.manage`
* Have a deposit with at least:
  * 2+ deposit line items, and
  * 2+ revenue schedules (for M:M), and
  * at least one schedule that is linked to an `opportunityProductId` and has a `scheduleDate` (required for bundle rip/replace)

### **Test 1 — 1:M Split allocation**

1. In the deposit reconciliation workbench, select **exactly 1 deposit line** and **2+ schedules**.
2. Click **Match**.
3. In the wizard:
   * verify detected type `1:M`
   * adjust allocations (ensure totals do not exceed the line totals)
   * **Run Preview** (should warn if schedules are outside tolerance; hard-block only on errors)
   * **Apply** (creates a match group)
4. Validate:
   * deposit line status becomes Matched / Partially Matched based on allocation completeness
   * schedule actuals + status recompute
   * audit entries exist for schedules + match group
5. In the wizard Apply step, click **Undo match group** and confirm all values recompute back.

### **Test 2 — M:1 Allocate (partial payment)**

1. Select **2+ deposit lines** and **exactly 1 schedule**.
2. Click **Match** → wizard opens in `M:1`.
3. Choose **Allocate** (not Bundle).
4. Run Preview → Apply → Undo match group.

### **Test 3 — M:M Allocation matrix**

1. Select **2+ deposit lines** and **2+ schedules**.
2. Click **Match** → wizard opens in `M:M`.
3. Confirm the default allocation proposal is prefilled (FIFO/greedy across schedules).
4. Run Preview → Apply → Undo match group.

### **Test 4 — Bundle / Rip-and-Replace**

1. Select **2+ deposit lines** and **exactly 1 schedule** (must have `opportunityProductId` + `scheduleDate`).
2. Click **Match** → wizard opens in `M:1`.
3. Choose **Bundle (Rip & Replace)**.
4. Choose a replace mode:
   * **Keep old schedules** (no deletion), or
   * **Soft-delete unreconciled old schedules**
5. Click **Create bundle schedules**.
6. Validate wizard switches into **M:M** and schedules list updates to the newly-created schedules for the current period, with 1:1 allocations prefilled.
7. Run Preview → Apply (match group).
8. Undo sequence:
   1. **Undo match group**
   2. **Undo bundle** (should succeed after match group undo; bundle undo is blocked if created schedules still have applied matches)

### **Test 5 — Validation / safety checks**

* Attempt multi-match with any **reconciled** line: it should be blocked.
* Attempt multi-match with a **negative** line item: preview should be blocked and direct you to the chargeback/flex flow.
* Attempt to include a line↔schedule pair that already belongs to an existing match group: preview should block (match-group conflict).

### **Automated tests**

* Run: `npm test`
  * Includes a unit test for the M:M FIFO default allocation proposal.

---

If you want, I can also output this as a “ticket-ready” breakdown (subtasks \+ acceptance tests per subtask) so your coding agent can translate it into implementation PRs quickly—without adding any new requirements beyond what’s already cited here.
