# CRM-FLEX-004 - Flex Resolution Workflow Review (Current vs Client Outline)

Date: **2026-02-02**

References:
- Client outline: `Reconciliation System.docx.md`
- Sprint context: `docs/plans/sprint-plan-ticket-log-2026-02-02.md`

This doc summarizes **how Flex works in the current repo today** (data model + API + UI behaviors), then compares it to the client's outline, and highlights **gaps / inconsistencies / risks**.

---

## 1) Mental model (what "Flex" means in this project)

In this repo, "Flex" is not one thing. It is a set of *exception-handling* behaviors that happen when:
- a deposit line is **negative** (chargeback), or
- a deposit allocation creates an **overage** (actuals exceed expected) outside tolerance, or
- a deposit line has **unknown / unmappable product context** and needs a placeholder.

Flex is represented primarily through:

- **`RevenueSchedule.flexClassification`** (what kind of exception schedule this is)
- **`RevenueSchedule.flexReasonCode`** (why it exists)
- **`RevenueSchedule.billingStatus` + `billingStatusSource`** (operational lifecycle: Open / Reconciled / In Dispute)
- **`FlexReviewItem`** (governance surface: a queue for approval / resolution workflow)
- **`DepositLineMatch`** (allocations between deposit lines and schedules)

---

## 2) Data model: key fields and enums

### 2.1 Core entities involved

```
Deposit
  +-- DepositLineItem (usage, commission, status, reconciled)
        +-- DepositLineMatch (Applied | Suggested)  <-- allocations (many-to-many)
              +-- RevenueSchedule (expected, actual, status, billingStatus, flexClassification, ...)
                    +-- FlexReviewItem (Open/Resolved/Rejected/Approved, assignment, notes)
```

### 2.2 Revenue schedule "status" vs "billing status"

This repo has *both*:

- `RevenueSchedule.status` (variance result / reconciliation state)
  - `Unreconciled | Underpaid | Overpaid | Reconciled`
- `RevenueSchedule.billingStatus` (operational workflow / reporting status)
  - `Open | Reconciled | InDispute`

Important operational rule (current code):
- If `billingStatusSource !== Auto`, automation will **not** change `billingStatus`.
- If `billingStatusSource === Auto`, billing status is computed, but **Flex disputes are sticky**:
  - `FlexProduct | FlexChargeback | FlexChargebackReversal` always compute to `billingStatus = InDispute`.

### 2.3 Flex classifications (what we create)

The repo uses `RevenueSchedule.flexClassification` to distinguish:
- `Adjustment` - created to absorb an overage (split off part of a deposit allocation).
- `FlexProduct` - placeholder schedule/product for overage outside tolerance or unknown product.
- `FlexChargeback` - placeholder schedule/product for negative amounts (chargebacks).
- `FlexChargebackReversal` - positive line that reverses a chargeback (CB-REV).
- `Bonus` - a bonus-like one-time schedule (used during some resolution paths).

### 2.4 Flex "product" representation

Flex product placeholders are **real `Product` rows** where:
- `Product.isFlex = true`
- `Product.flexType = "FlexProduct" | "FlexChargeback" | "FlexChargebackReversal"`

Flex product scoping (intended alignment):
- `FlexChargeback` / `FlexChargebackReversal` products are reused per **Distributor+Vendor** when both are present (and use `flexAccountId = null`).
- `FlexProduct` placeholder products are reused per **Distributor+Vendor** when both are present (and use `flexAccountId = null`), while the per-deal identity lives on `OpportunityProduct`.

When a Flex Product is created for an Opportunity, the flex schedule should reference a dedicated `OpportunityProduct` line item (not the base product's line item) to keep downstream context correct.

Fallback behavior: if Distributor/Vendor context is missing, reuse may fall back to account-scoped products via `flexAccountId`.

---

## 3) Workflow: where Flex is triggered during reconciliation

There are two main "entry points" in the reconciliation UI:

1) **Apply a match** (deposit line -> schedule allocation)
2) **Create flex entry** (operator forces a flex placeholder for a line)

### 3.1 Apply match (`POST /api/reconciliation/deposits/:depositId/line-items/:lineId/apply-match`)

When a user allocates a deposit line to a schedule:

```
Apply match
  +-- if negative line (usage < 0 OR commission < 0) -> chargeback path
  +-- else -> compute variance / overage decision
```

#### 3.1.a Negative line -> Chargeback auto-create (pending approval)

If the line is negative, the API:
- creates (or reuses) a `Product` with `flexType="FlexChargeback"`
- creates a `RevenueSchedule` with:
  - `flexClassification = FlexChargeback`
  - `billingStatus = InDispute` (when billing automation enabled; default is ON)
- creates a **Suggested** (pending) `DepositLineMatch` (not applied)
- sets the `DepositLineItem.status = Suggested`, leaving it unallocated until approved
- enqueues a `FlexReviewItem` titled "Chargeback pending approval"

Chargeback normalization implemented:
- If `usage == 0` and `commission < 0`, the system sets:
  - `usage = abs(commission)`
  - `commissionRate = 1` (100%)

#### 3.1.b Non-negative line -> Flex decision evaluation

After applying the allocation, the schedule is recomputed and a Flex decision is evaluated:

```
decision = evaluateFlexDecision({
  expectedUsageNet,
  usageBalance,
  expectedCommissionNet,
  commissionDifference,
  varianceTolerance,
  isBonusLike,
  hasNegativeLine: false
})

decision.action:
  - none        (no overage)
  - auto_adjust (overage exists, within tolerance)
  - prompt      (overage exists, above tolerance)
```

Current behaviors:
- `auto_adjust`: automatically creates an **Adjustment** split schedule and allocates it.
- `prompt`: returns prompt options to UI:
  - `Adjust` (guided / AI adjustment modal)
  - `Manual` (operator specifies the split amount)
  - `FlexProduct` (create flex product schedule)

Important nuance:
- "Adjust" in this repo generally means **create an Adjustment schedule (split)**, not rewrite the base schedule's expected usage.

### 3.2 Resolve flex prompt (`POST /api/reconciliation/deposits/:depositId/line-items/:lineId/resolve-flex`)

When the UI receives `decision.action = "prompt"` it offers choices:

```
Overage above tolerance
  +-- Adjust -> executeFlexAdjustmentSplit(...)
  +-- Manual -> executeFlexAdjustmentSplit(...) with operator-entered amount
  +-- FlexProduct -> executeFlexProductSplit(...)
```

If `applyToFuture` is used (only supported for `Adjust`), the API applies expected deltas to future schedules in the same scope.

### 3.3 Create flex entry (operator-forced)

`POST /api/reconciliation/deposits/:depositId/line-items/:lineId/create-flex`

This endpoint is used when an operator clicks "Create Flex" in the reconciliation UI. It can create:

- `Chargeback` (negative line -> FlexChargeback + pending approval match)
- `ChargebackReversal` (positive line attached to a selected FlexChargeback schedule)
- `FlexProduct` (unknown product placeholder)
  - optionally "attach" to an opportunity/schedule for vendor/distributor context

---

## 4) Workflow: Flex Review Queue (governance surface)

UI page:
- `Reconciliation -> Flex Review Queue` (`/reconciliation/flex-review`)

API listing:
- `GET /api/flex-review` supports filters (status, assignment, classification, reason, vendor/distributor search, etc.)

The queue separates two governance behaviors:

### 4.1 Chargebacks: "approve and apply" (ADMIN)

Chargebacks and chargeback reversals cannot be "resolved" via the non-chargeback resolution actions.

They are approved via:
- `POST /api/flex-review/:itemId/approve-and-apply` (requires ADMIN)
  - finds the pending Suggested `DepositLineMatch`
  - flips it to Applied
  - recomputes schedule + allocations + deposit aggregates
  - marks the queue item `Approved`

There is also a deposit-line-level approval endpoint:
- `POST /api/reconciliation/deposits/:depositId/line-items/:lineId/approve-flex`

### 4.2 Flex products (and other non-chargeback flex): explicit resolution actions

`POST /api/flex-review/:itemId/resolve`

Non-chargeback flex items can be resolved via one of:

- **ApplyToExisting**
  - Adds the flex schedule's expected amounts to a target schedule (default: parent when present)
  - Moves/merges `DepositLineMatch` records onto the target schedule
  - Soft-deletes (archives) the flex schedule (`deletedAt`)
- **ConvertToRegular**
  - Converts a Flex schedule into a normal schedule by assigning a real product, clearing flex fields, and choosing one-time vs recurring
  - Optionally creates additional recurring schedules
- **BonusCommission**
  - Converts the schedule into a one-time Bonus schedule

Billing status behavior during resolution:
- These resolution actions set billing status source to `Manual` for the resolved schedule.
- Parent schedule dispute clearing is conditional on:
  - parent is `InDispute` and `billingStatusSource = Auto`
  - there are **no remaining** flex children in dispute
  - then parent billing status becomes `Open` or `Reconciled` based on recompute + unreconciled applied matches

---

## 5) ASCII flow diagrams

### 5.1 Match apply decision tree (high level)

```
DepositLineItem + chosen RevenueSchedule
          |
          v
POST apply-match
  |
  +--> negative? -------------------- yes --> create FlexChargeback (InDispute)
  |                                      + Suggested match (pending)
  |                                      + FlexReviewItem(Open) -> needs ADMIN approval
  |
  +--> negative? -------------------- no --> recompute schedule variance
                                         |
                                         +--> overage? no  -> done
                                         |
                                         +--> overage within tolerance -> auto create Adjustment split (applied)
                                         |
                                         +--> overage above tolerance  -> UI prompt:
                                               - Adjust (split) (+ optional future deltas)
                                               - Manual (split)
                                               - FlexProduct (split + InDispute + FlexReviewItem)
```

### 5.2 Governance queue

```
FlexReviewItem(Open)
  |
  +--> FlexChargeback / FlexChargebackReversal
  |        |
  |        +--> Approve & apply (ADMIN) -> match Applied, recompute, item Approved
  |
  +--> FlexProduct (and non-chargeback flex)
           |
           +--> Resolve action:
                 - ApplyToExisting (archive flex schedule)
                 - ConvertToRegular (assign product + create recurrences)
                 - BonusCommission
```

---

## 6) Comparison to the client outline (Reconciliation System.docx.md)

This maps the client outline's Flex expectations to current repo behavior.

### 6.1 Flex Product creation (overage outside tolerance)

Client outline expects:
- create a "Flex Product" + child schedule "1234.1"
- allocate overage to flex schedule
- set **both** flex + parent to "In Dispute"

Current repo:
- creates a one-time `RevenueSchedule` with `flexClassification = FlexProduct`
- sets `parentRevenueScheduleId = <baseScheduleId>` (so parent-child link exists)
- allocates overage via split (moves part of the deposit match to flex schedule)
- sets `billingStatus = InDispute` for the flex schedule (auto)
- sets parent `billingStatus = InDispute` only when:
  - billing status automation is enabled (default ON), and
  - the parent schedule's billing status source is still `Auto`

Naming difference:
- client spec shows "1234.1"
- current schedule numbers are global sequential ("10000", "10001", ...) and the UI display adds suffixes:
  - `-F`, `-CB`, `-CB-REV`

### 6.2 Flex Chargeback creation (negative lines)

Client outline expects:
- auto-create Flex Chargeback product/schedule
- normalize missing usage (usage = abs(commission), rate=100%)
- set Billing Status = "In Dispute" immediately
- approval (if exists) is separate from Billing Status; approval does not clear dispute

Current repo:
- aligns on normalization rules
- creates FlexChargeback schedule with `billingStatus = InDispute` (auto)
- adds an approval gate:
  - creates a **Suggested** match (pending approval), not an Applied match
  - deposit line remains in "Suggested" status until approved
- billing status remains "In Dispute" even after approval (flex disputes are sticky while classification is chargeback)

### 6.3 Post-investigation resolution (rename popup / convert-to-regular)

Client outline expects:
- guided popup to "rename" Flex product into a real catalog product
- distributor/vendor locked
- require Family/Subtype then filtered product selection
- optionally create future schedules (recurring vs one-time)
- clear dispute statuses when resolved
- prompt to update catalog if missing

Current repo:
- has a guided Convert-to-Regular workflow in Flex Review Queue:
  - Family/Subtype required; product list filtered (when vendor/distributor context exists)
  - supports one-time vs recurring + additional schedules
  - clears flex schedule dispute via explicit resolution action (billing status set to Manual)
  - conditionally clears parent dispute when no remaining disputed flex children
- does **not** have an explicit "add missing product to catalog" flow inside resolution; product must already exist/selectable

### 6.4 Disputes & Collections model

Client outline expects:
- explicit Dispute + Collections reporting and workflows
- collections triggered by underpayment outside tolerance

Current repo:
- has `RevenueSchedule.status = Underpaid` for underpayment cases
- has `billingStatus = InDispute`, plus a settlement endpoint for "AcceptActual" / "WriteOff"
- does **not** implement a first-class "Collections" flag/workflow/report (tracked in sprint plan as CRM-FLEX-002)

---

## 7) Gaps / inconsistencies / issues (current vs client outline)

### High impact / likely client-visible

1) **Flex schedule naming convention differs**
   - Client expects parent/child numbering like `1234` -> `1234.1`.
   - Alignment decision: store child `RevenueSchedule.scheduleNumber` as `parentNumber.N` whenever a schedule is created as a child (`parentRevenueScheduleId` set), so the literal stored value reflects sibling relationships.
   - Remaining nuance: chargeback types may still show classification suffixes in some UI surfaces (`-CB`, `-CB-REV`) for clarity.

2) **Chargebacks are not "applied" until approval**
   - Client flow reads like a placeholder allocation exists immediately (even if disputed).
   - Current flow creates a **Suggested** match and leaves the deposit line unallocated until ADMIN approval.
   - Risk: operational reporting may show "unallocated deposit" that client expects to be allocated-but-disputed.

3) **Flex placeholder product scoping differs from client expectation**
   - Client outline implies standard "Flex Chargeback" exists per Distributor+Vendor combination.
   - Alignment decision: scope `FlexChargeback` / `FlexChargebackReversal` products per **Distributor+Vendor** (not per customer account) so reporting/matching context stays correct.
   - Flex Product nuance: treat Flex Product identity as an Opportunity Product line item (deal-scoped) to avoid polluting/overloading the global catalog concept.

4) **Resolution action can clear parent dispute in more cases than the client clarification**
   - Client clarification: clearing parent dispute should be conditional "only when applying into the base" and no remaining disputed flex children.
   - Current implementation attempts parent clearing for Apply, Convert, and Bonus paths (still conditional on no remaining disputed flex children).
   - Risk: parent dispute could clear in scenarios the client expects to remain "In Dispute".

### Medium impact / workflow sharp edges

5) **Flex Review item can be marked Resolved/Rejected without a resolution action**
   - If the resolve request omits `action`, the item status updates, but no schedule mutation occurs.
   - Risk: the queue can show "Resolved" while the schedule remains `InDispute` and unresolved in practice.

6) **Within-tolerance auto-adjust does not offer "apply to future schedules"**
   - Client flow mentions prompting to apply adjustments to open future schedules.
   - Current "auto_adjust" just creates the Adjustment split and returns success.
   - Risk: client expects a consistent apply-to-future prompt whenever an adjustment is created.

7) **Convert-to-regular assumes the real product exists**
   - Client outline includes "update catalog (if needed)" as part of resolution.
   - Current workflow requires selecting an existing product; missing-product creation is outside the flow.

### Low impact / verify-in-real-data (not necessarily missing, but needs confirmation)

8) **Parent dispute setting is conditional on billingStatusSource=Auto**
   - If an operator has manually controlled billing status on the parent schedule, flex creation won't auto-set parent to InDispute.
   - This may be desirable (respect manual governance) but differs from a strict reading of the client outline ("set both to In Dispute").

9) **Chargeback usage/commission mapping assumptions**
   - For normalized chargebacks, the system mutates the deposit line's `usage` and `commissionRate`.
   - Confirm this is acceptable for auditability and reporting expectations.

---

## 8) Suggested next steps (if we want closer alignment)

If the client outline is the target operating model, the highest-leverage next decisions:

- Implement literal child `RevenueSchedule.scheduleNumber` formatting (`1234.1`) for sister/child schedules (not display-only).
- Add a tenant setting (with RBAC) to choose whether disputed deposits can be finalized or must be blocked; default: allow managers/admins to finalize while disputed.
- Scope `FlexChargeback` / `FlexChargebackReversal` placeholder products per Distributor+Vendor (not per customer account).
- Treat `FlexProduct` as an Opportunity Product line item (deal-scoped) rather than a "main catalog" selection, and use the Opportunity Product detail page for that line item to avoid downstream context confusion.
- Define "Resolved" as "finalized + no disputes" (i.e., Billing Status = `Reconciled`) and display it as "Resolved" in the UI.
