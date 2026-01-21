# Plan: Finalize Deposit → Review Matches Page

## Goal

Replace the current **Finalize Deposit** modal with a dedicated page that:

- Reuses the exact same **top detail/summary section** from the existing **Deposit Reconciliation detail** page.
- Shows **one dynamic table** underneath: a **Review Matches** table for pre-finalization review.
- Allows the user to **Confirm & Finalize** from this page (using the existing finalize API).

## Current vs Desired UX

### Current (Screenshot 1)

- User clicks **Finalize Deposit** on the deposit reconciliation detail page.
- A modal opens with two simple lists/tables:
  - Matched Line Items
  - Matched Revenue Schedules
- User confirms finalize from the modal.

### Desired (Screenshot 2)

- User clicks **Finalize Deposit** and is navigated to a new page:
  - Top: same detail/summary section as Deposit Reconciliation detail page.
  - Below: **Review Matches** (single table) showing the allocations/matches to review.
  - CTA: **Confirm & Finalize**.

## Key Decisions / Open Questions

1. What exactly is a “match” row in the Review Matches table?
   - Option A (recommended): **one row per applied `DepositLineMatch`** (line ↔ schedule allocation).
   - Option B: **one row per `DepositLineItem`** with nested/multi-column match summary (count + primary schedule + totals).
2. Which match statuses appear?
   - Likely: `DepositLineMatch.status = Applied` (and optionally show `Suggested` in a separate filter).
3. What actions are allowed on this page (pre-finalize)?
   - Recommended minimum: **Undo/Unmatch** (reuse existing unmatch endpoint per line item).
   - Optional: edit allocation amounts, open schedule/line detail, bulk undo, etc.
4. Finalize rules UX:
   - API currently blocks finalize if any lines remain `Unmatched`/`Suggested`.
   - Decide whether this page should show a blocking warning banner + disable CTA until ready.

## Backend Plan (API/Data)

### 1) Add “matches for deposit” endpoint

Create an API route to fetch matches for review, e.g.:

- `GET /api/reconciliation/deposits/[depositId]/matches`

Return either:

- **Match-row shape** (Option A):
  - `DepositLineMatch` fields (id, usageAmount, commissionAmount, confidenceScore, status, source, reconciled…)
  - Joined `DepositLineItem` display fields (lineNumber, accountNameRaw/account, productNameRaw/product, usage/commission totals…)
  - Joined `RevenueSchedule` display fields (name/id, account/legal name, product, period/status…)
- **Line-row shape** (Option B):
  - One row per line item with aggregated match totals + nested matches list.

Implementation notes:

- Use `withPermissions(["reconciliation.view"])` for read access.
- Query by `(tenantId, depositId)` and join via Prisma relations:
  - `depositLineMatch.findMany({ where: { tenantId, depositLineItem: { depositId } }, include: { depositLineItem: ..., revenueSchedule: ... } })`
- Support query params for filtering if needed (status/source/search).

### 2) Reuse existing finalize/unmatch endpoints

- Finalize: `POST /api/reconciliation/deposits/[depositId]/finalize`
- Undo/unmatch: `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch`

No behavior changes needed initially; only call patterns move to the new page.

## Frontend Plan (UI/Routes)

### 1) Extract reusable “top detail section”

The new finalize page must reuse the exact same UI as the reconciliation detail header.

Recommended refactor:

- Extract the header section from `components/deposit-reconciliation-detail-view.tsx` into a dedicated component, e.g.:
  - `components/deposit-reconciliation-header.tsx`
- The existing detail page continues to render:
  - Header component
  - Existing two-table reconciliation layout
- The new finalize page renders:
  - Header component
  - Review Matches table

### 2) Create new page route

Add a new nested route under reconciliation deposit detail:

- `app/(dashboard)/reconciliation/[depositId]/finalize/page.tsx`

Responsibilities:

- Load deposit metadata (reuse existing `/detail` fetch).
- Load matches for review (new `/matches` fetch).
- Render:
  - Header (shared component)
  - Review Matches table
  - Footer action bar: **Back/Cancel** and **Confirm & Finalize**

### 3) Implement Review Matches table

Reuse the same table system already used in reconciliation (styling + toolbar patterns).

Suggested MVP capabilities:

- Columns (example; finalize after confirming product requirements):
  - Line #, Account, Product, Usage, Commission
  - Schedule, Schedule Status/Period
  - Allocated Usage/Commission
  - Confidence/Source (if helpful)
  - Actions: Undo/Unmatch
- Sorting + search at minimum; filters optional for MVP.
- Empty state when there are no applied matches.

### 4) Update “Finalize Deposit” button behavior

In `components/deposit-reconciliation-detail-view.tsx`:

- Replace `setShowFinalizePreview(true)` with navigation to the finalize page route.
- Remove or deprecate the old finalize preview modal once the new page is ready.

### 5) Breadcrumbs + navigation

On the new finalize page:

- Breadcrumbs: Home → Reconciliation → Deposit Detail → **Finalize Deposit**
- Back/Cancel returns to `/reconciliation/[depositId]`.

## Acceptance Criteria

- Clicking **Finalize Deposit** navigates to `/reconciliation/[depositId]/finalize`.
- The top detail section matches the reconciliation detail page exactly (shared component, not duplicated code).
- The Review Matches table loads dynamically from the DB and shows matches for the deposit.
- User can Undo/Unmatch from the review table and see the table refresh.
- **Confirm & Finalize** finalizes successfully when eligible; shows a clear error when blocked by unmatched lines.
- Finalized deposits hide/disable finalize actions appropriately.

## QA Checklist / Test Cases

- Deposit with:
  - 0 matches → table empty state + finalize disabled or error explained.
  - Some applied matches + remaining unmatched lines → finalize CTA blocked/warning.
  - All lines matched/eligible → finalize succeeds and redirects back to deposit detail (showing status Completed).
  - Already finalized → finalize route redirects or shows “already finalized” state.
- Permissions:
  - `reconciliation.view` only → can view review page but cannot finalize/unmatch (disable actions).
  - `reconciliation.manage` → can unmatch + finalize.

## Rollout Notes

- Ship behind a minimal change first:
  - New page + navigation + read-only table.
  - Then add unmatch actions.
  - Then add polish (filters, bulk actions, deep links, etc.).

