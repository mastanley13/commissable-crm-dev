# Milestone 2 — Flex Resolution (Summary + Remaining Blockers)

Date: **Feb 2, 2026**

References:
- `Reconciliation System.docx.md`
- `docs/plans/flex-chargeback-handoff.md`

---

## What we implemented (Milestone 2)

Milestone 2 focuses on making **Flex Review Queue resolution actions perform real system mutations**, aligned with the reconciliation/variance-management workflow:

### 1) Flex Review Queue: resolution actions are now “real”

The Flex Review Queue can now resolve FLEX items with explicit outcomes (instead of only marking the queue item resolved).

**Backend:**
- `POST /api/flex-review/[itemId]/resolve` now supports these actions:
  - **Option A — ApplyToExisting**
    - Adds the flex schedule’s `expectedUsage` / `expectedCommission` into a target schedule (defaults to the parent schedule when present).
    - Moves any `DepositLineMatch` rows from the flex schedule to the target schedule (merging if a match already exists for the same line + target schedule).
    - Soft-deletes (archives) the flex schedule (`deletedAt`) after moving the balances.
    - Recomputes: target schedule status/actuals, affected deposit line allocations, and affected deposit aggregates.
  - **Option B — ConvertToRegular**
    - Converts the flex schedule into a “normal” schedule by changing:
      - `productId` (selected from catalog),
      - `flexClassification` → `Normal`,
      - clears `parentRevenueScheduleId` and flex reason fields,
      - sets `scheduleType` as one-time or recurring (user choice).
    - Creates (or links) an `OpportunityProduct` for the chosen product when the schedule is tied to an Opportunity.
    - If recurring + additional schedules requested, creates additional monthly schedules using `generateRevenueScheduleName()`.
    - Recomputes schedule status/actuals and explicitly updates billing status for the resolved schedule.
  - **Option C — BonusCommission**
    - Converts the flex schedule into a one-time **Bonus** schedule (100% rate semantics).
    - Normalizes usage for commission-only bonus cases (when usage is 0 but commission exists).
    - Recomputes schedule status/actuals and explicitly updates billing status for the resolved schedule.

**UI:**
- `Reconciliation → Flex Review Queue` now has a `Resolve` action for FLEX items that opens an inline resolution panel:
  - Option A: target schedule id/number (with “Use parent” shortcut when present)
  - Option B: requires Family + Subtype, then filters Product list and lets you pick a product; supports one-time vs recurring and optional additional schedule creation
  - Option C: bonus commission path
  - Notes field included for operator context

### 2) Product selection workflow for Convert-to-Regular

Convert-to-Regular aligns with the “rename/convert” workflow in the reference docs:
- Requires **Product Family + Product Subtype** selection first.
- Filters the product list by:
  - vendor/distributor on the schedule (when available),
  - selected family + subtype.

### 3) Billing Status semantics + parent clearing rule

Aligned with the clarification in `Reconciliation System.docx.md`:
- FLEX schedules are cleared from **In Dispute** only via **explicit resolution actions** (these actions set `billingStatusSource = Manual` for the resolved schedule).
- Parent schedule dispute clearing is **conditional**:
  - parent dispute is only cleared when there are **no remaining disputed flex children** for that parent.

### 4) Auditing

Audit entries are emitted for the key schedule mutations:
- target schedule updates (Option A),
- flex schedule soft-delete (Option A),
- schedule conversion (Option B),
- recurring schedule creation (Option B),
- bonus conversion (Option C),
- and the FlexReviewItem resolve action.

### 5) Data returned to the queue

The Flex Review queue API now returns additional context needed to drive resolution UX (parent schedule, vendor/distributor context, schedule date).

---

## Files changed for Milestone 2

- `app/api/flex-review/route.ts` (queue payload extended for UI context)
- `app/api/flex-review/[itemId]/resolve/route.ts` (Option A/B/C resolution actions + recompute + audits + parent dispute clearing)
- `app/(dashboard)/reconciliation/flex-review/page.tsx` (resolution UI + product family/subtype/product selection)
- `docs/plans/flex-chargeback-handoff.md` (progress update entry for Milestone 2)

---

## Remaining Milestone 2 blockers (what still must be proven)

These are “confidence blockers” (verification gaps) rather than missing implementation:

### Blocker A — End-to-end UI smoke for Option A/B/C

You should run a full browser smoke to confirm each resolution path behaves as intended:
- **Option A:** expected amounts move into the target schedule; flex schedule becomes archived; matches are moved/merged correctly.
- **Option B:** schedule becomes normal and linked to the correct catalog product (and OpportunityProduct when applicable); recurring creates additional schedules with correct dates.
- **Option C:** bonus schedule behavior matches expectation and dispute clears via explicit resolution.

### Blocker B — Billing status correctness in real UI flow

Confirm:
- resolved schedule exits `InDispute` only via explicit resolution,
- parent schedule clears `InDispute` only when it has no remaining disputed flex children,
- no “silent auto-clear” occurs.

### Blocker C — Product filtering correctness for Convert-to-Regular

Confirm the product list shown after selecting Family/Subtype is correct for:
- vendor/distributor constraints,
- expected tenant picklist values (families/subtypes),
- and includes the products you need for the scenarios.

### Blocker D — Operational audit visibility

Confirm the audit trail for the resolution actions is visible in the audit view you rely on (who/when/what moved/what was created/what was archived).

---

## Suggested testing approach (to clear blockers quickly)

### 1) Create a Flex Review item (FLEX schedule)

In the Reconciliation deposit detail page:
1. Apply a match that results in an **overage outside tolerance**.
2. Choose **Flex Product** when prompted.
3. Verify the Flex Review Queue shows an **Open** item for the new flex schedule.

### 2) Validate Option A (Apply to existing schedule)

From the Flex Review Queue:
1. Click `Resolve`.
2. Select **Apply to existing schedule**.
3. Use “Use parent” (or paste target schedule id).
4. Click `Apply Resolution`.

Verify:
- flex schedule is archived (soft deleted),
- target schedule expected amounts increased by flex expected amounts,
- moved `DepositLineMatch` rows now point to the target schedule,
- deposit line allocations and deposit aggregates reflect the move.

### 3) Validate Option B (Convert to regular schedule)

From the Flex Review Queue:
1. Click `Resolve`.
2. Select **Convert to regular schedule**.
3. Choose Family + Subtype (picklists).
4. Select a product.
5. Choose one-time vs recurring.
6. If recurring: set additional schedule count + start date.
7. Click `Apply Resolution`.

Verify:
- schedule now appears as a normal (non-`-F`) schedule,
- schedule product linkage is correct,
- additional schedules created have correct month-start dates and expected amounts,
- billing status for the resolved schedule is correct.

### 4) Validate Option C (Bonus commission)

From the Flex Review Queue:
1. Click `Resolve`.
2. Select **Bonus commission**.
3. Click `Apply Resolution`.

Verify:
- schedule is now treated as Bonus/one-time with expected 100% behavior,
- billing status clears via explicit resolution.

### 5) Re-run on “realistic” data cases

After the first pass, repeat with:
- a flex item that has deposit matches (to validate match move/merge logic),
- a flex item with parent schedule (to validate parent dispute clearing),
- and a Convert-to-Regular case where the selected product is expected to exist for the vendor/distributor combo.

---

## Recommendation: proceed to Milestone 3?

Proceed to Milestone 3 **after** clearing the blockers above (A–D). Milestone 3 is mostly “ops polish” (filters, bulk actions, notifications, reporting hardening), and it’s best to build it once the resolution semantics are validated in the UI.

