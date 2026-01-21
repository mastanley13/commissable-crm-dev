# Reconciliation — Deposits, Matching, and Finalization

## Executive summary

The **Reconciliation** feature set is the workflow that turns an imported **Deposit** (from Deposit Upload) into finalized financial allocations against expected **Revenue Schedules**. Users work deposit-by-deposit, line-by-line, applying allocations (manual or “AI” assisted) and handling variances through **adjustments**, **flex products**, and **chargebacks**.

At a high level:
1. Finance uploads a deposit report → a **Deposit** and **Deposit Line Items** are created.
2. Finance opens the deposit and matches each line item to one or more **Revenue Schedules**.
3. Variances are resolved (within tolerance auto-adjusts; outside tolerance prompts user actions).
4. Special cases like negative amounts become **chargebacks** requiring approval.
5. When ready, the deposit is **finalized** (locked), or **reopened** if corrections are needed.

---

## Pages (routes + implementation references)

- Deposits list: `/reconciliation` (`app/(dashboard)/reconciliation/page.tsx`)
- Deposit detail: `/reconciliation/[depositId]` (`app/(dashboard)/reconciliation/[depositId]/page.tsx`)
- AI matching: `/reconciliation/[depositId]/ai-matching` (`app/(dashboard)/reconciliation/[depositId]/ai-matching/page.tsx`)
- Flex review queue: `/reconciliation/flex-review` (`app/(dashboard)/reconciliation/flex-review/page.tsx`)
- Reconciliation settings: `/settings` → “Reconciliation Settings” (`components/reconciliation-settings-form.tsx`)

Core APIs (not exhaustive):
- Deposits list: `GET /api/reconciliation/deposits` (`app/api/reconciliation/deposits/route.ts`)
- Deposit detail: `GET /api/reconciliation/deposits/[depositId]/detail` (`app/api/reconciliation/deposits/[depositId]/detail/route.ts`)
- Suggested matches: `GET /api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates` (`app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts`)
- Apply match (manual allocation): `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match`
- Unmatch line (remove all allocations for a line): `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch`
- Create flex entry: `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/create-flex`
- Resolve flex variance: `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/resolve-flex`
- AI adjustment preview/apply: `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/preview|apply`
- Finalize/unfinalize: `POST /api/reconciliation/deposits/[depositId]/finalize|unfinalize`
- Delete deposit: `DELETE /api/reconciliation/deposits/[depositId]`
- Flex review APIs: `GET /api/flex-review`, `POST /api/flex-review/[itemId]/assign|approve-and-apply|resolve`

---

## Permissions and roles

- **Read-only access** (view deposits, candidates, templates): `reconciliation.view`
- **Write access** (match/unmatch, create flex, finalize/unfinalize, delete deposits, manage settings, run flex review): `reconciliation.manage`

---

## Core concepts (data model mental model)

### Deposit

Represents a single imported “deposit” (typically a monthly payout report):
- Has a `paymentDate` (deposit received date) and a `month` (commission period).
- Tracks totals and rollups: total usage/commission, allocated vs unallocated, item counts.
- Has two layers of “completion”:
  - `status`: `Pending | InReview | Completed` (derived from line allocation state)
  - `reconciled` + `reconciledAt`: a **locking**/finalization flag

### Deposit line item

One row from the uploaded deposit file:
- Contains raw identifiers (account name, order ID, customer ID, etc.) plus amounts (`usage`, `commission`).
- Is allocated by creating one or more **matches** to revenue schedules.
- Tracks allocation totals (`usageAllocated`, `usageUnallocated`, etc.) and a line `status`:
  - `Unmatched` (no applied allocations)
  - `PartiallyMatched` (some allocations applied)
  - `Matched` (fully allocated)
  - `Suggested` (used for pending chargeback/CB-reversal approval)
  - `Ignored` (excluded from reconciliation; cannot be allocated)

### Revenue schedule (expected amounts)

Represents expected revenue/commission for a customer + product + period. When allocations are applied, the system recomputes:
- `actualUsage` / `actualCommission` from applied matches
- `status`: `Unreconciled | Underpaid | Overpaid | Reconciled` based on variance tolerance

### Match (allocation)

Allocations are stored in `DepositLineMatch`, a many-to-many join between deposit line items and revenue schedules:
- Supports split/merge allocations:
  - One deposit line can be split across multiple schedules.
  - One schedule can be paid by multiple deposit lines.
- Tracks `usageAmount` and `commissionAmount` per association.
- Has a `status`:
  - `Applied` (counts toward allocations)
  - `Suggested` (pending approval, used for chargeback flows)
  - `Rejected` (currently reserved)
- Has a `source`: `Manual | Auto`

---

## End-to-end workflow (recommended)

### 1) Find the deposit to reconcile (Deposits List)

On `/reconciliation`:
- Use the month arrows to filter by **deposit received month** (based on `paymentDate`).
- Use search and column filters to narrow down by deposit name / distributor / vendor.
- Click a row to open **Deposit Detail**.

User actions:
- **Deposit Upload**: starts a new import (links to the Deposit Upload wizard).
- **Export CSV** (bulk): exports selected deposit summary rows.
- **Delete** (bulk): permanently deletes selected deposits, blocked if:
  - `deposit.reconciled === true`, or
  - `deposit.status === "Completed"`

### 2) Match deposit lines to schedules (Deposit Detail)

On `/reconciliation/[depositId]`:
- The left table shows **Deposit Line Items**.
- Selecting a line item loads **Suggested Matches (Revenue Schedules)** for that line (right table).
- Select one schedule and use **Match** to allocate, or **Remove Match** to clear allocations.

Key actions available to users (when `reconciliation.manage` is present):
- **Match** (Apply allocation)
  - Requires exactly one line item + one schedule selected.
  - Allocation amounts can be entered (partial allocation) or left blank (defaults to full line amounts).
  - Server enforces “no over-allocation” (you cannot allocate more than the remaining unallocated usage/commission for a line).
- **Remove Match** (Unmatch)
  - Removes *all* applied matches for the selected line item and resets it to `Unmatched`.
- **Create Flex Product / Chargeback**
  - Creates special “flex” schedules to handle variances, unknown product lines, or negative amounts.
- **Use AI Matching**
  - Opens the AI matching page for preview + apply.
- **Finalize Deposit** / **Reopen Deposit**
  - Locks/unlocks editing.
- **Delete Deposit**
  - Permanently deletes the deposit and all associated line items + allocations (blocked if reconciled/completed).

Suggested match controls:
- **Include Future-Dated Schedules** toggle (per deposit view)
  - Expands candidate search window forward in time; default behavior is driven by tenant settings.

### 3) Handle variances and special cases

After applying a match, the server recomputes the selected revenue schedule’s balance:
- If the schedule is **overpaid** (or otherwise outside tolerance), the UI may prompt the user to choose a resolution path:
  - **Adjustment**: create an “adjustment” entry to align expected to observed.
  - **Manual**: specify an adjustment amount (within the detected overage).
  - **Flex Product**: create a new flex product schedule to absorb the variance.
  - **AI Adjustment**: preview a recommended approach and optionally apply changes to future schedules.

Negative amounts (chargebacks):
- If a deposit line has negative usage or commission, matching is blocked.
- The system creates a **Flex Chargeback** schedule and a **pending (Suggested)** match.
- The line remains unallocated until a manager approves it in the **Flex Review Queue**.

### 4) Run AI Matching (optional accelerator)

On `/reconciliation/[depositId]/ai-matching`:
- The system generates a preview list of line items whose **top candidate** has confidence ≥ your **Auto-match confidence threshold**.
- Clicking **Apply allocations** creates applied matches (`source: Auto`) for those lines.

Important clarification:
- “AI Matching” here is a deterministic scoring engine (no external ML/LLM calls). See `lib/matching/deposit-matcher.ts`.

### 5) Finalize (lock) or reopen (unlock)

Finalize:
- Finalization is the lock step that sets:
  - `Deposit.reconciled = true` and `Deposit.reconciledAt = now`
  - `DepositLineItem.reconciled = true` for matched/partially matched lines
  - `DepositLineMatch.reconciled = true` for applied matches
- The finalize API blocks finalization when any lines remain:
  - `Unmatched` or `Suggested`

Reopen:
- Clears `reconciled` flags and sets the deposit back to an “in review” state.

---

## How “Suggested Matches” are generated (logic overview)

For a selected deposit line, the candidates API:
- Builds a candidate universe of revenue schedules:
  - Same tenant
  - Schedule date window around the deposit/line date (default ±1 month, with optional future window)
  - Only schedules not fully reconciled (`Unreconciled`, `Underpaid`, `Overpaid`)
  - Filters out schedules with no remaining commission due
- Scores candidates using either:
  - **Hierarchical** mode (default): Pass A exact match within tolerance, else Pass B fuzzy scoring
  - **Legacy** mode (optional)
- Returns top candidates along with a 0–1 `matchConfidence` and “reasons” explaining the score
- Filters displayed suggestions by the user’s **Suggested Matches min confidence** preference

---

## Settings that affect reconciliation

### Tenant settings (shared defaults)

Stored as `SystemSetting` keys:
- `reconciliation.varianceTolerance` (0–1; UI shows percent)
- `reconciliation.includeFutureSchedulesDefault` (boolean)
- `reconciliation.engineMode` (`hierarchical` default; `legacy` optional)

UI: `/settings` → “Reconciliation Settings” currently exposes `varianceTolerance` (tenant) plus the user confidence thresholds. `includeFutureSchedulesDefault` and `engineMode` exist and are honored in some backend flows, but are not currently configurable from that settings form.

### User settings (per-user preferences)

Stored as `UserSetting` keys:
- `reconciliation.suggestedMatchesMinConfidence` (0–1; default 0.70)
- `reconciliation.autoMatchMinConfidence` (0–1; default 0.95)

Used to:
- Filter which candidates appear in “Suggested Matches”
- Decide which lines qualify for “AI Matching” auto-allocation

---

## Operational notes / known behaviors

- **Unmatch removes all allocations for a line**: it deletes all applied matches for the line item, not just a single schedule association.
- **Chargeback flows use “Suggested” status**: pending chargebacks/CB-reversals intentionally create suggested matches that require manager approval before becoming applied allocations.
- **Auto-match vs schedule recomputation**: manual matching recomputes the affected revenue schedule immediately; auto-match focuses on applying matches and updating deposit/line aggregates (schedule recomputation is performed in other flows such as finalize/unfinalize/delete and manual actions).
- **Delete is intentionally strict**: deposits cannot be deleted once marked `reconciled` or once their status is `Completed`.
- **Finalize allows partially matched lines** (current behavior): the finalize API blocks only when lines are `Unmatched` or `Suggested`; lines with `PartiallyMatched` status can still be finalized/locked even if they have unallocated amounts.
- **Finalize vs deposit status**: deposit `status` is recalculated from line allocations and can become `Completed` when all lines are matched/ignored. The finalize API currently treats `status === "Completed"` as “already finalized,” even if `reconciled` is still false.

---

## Related guides

- Deposit upload workflow: `docs/guides/deposit-upload.md`
