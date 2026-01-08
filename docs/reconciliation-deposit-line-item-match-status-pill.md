# Deposit Reconciliation: Matching Controls

This document describes how users apply and remove matches in the **Deposit Reconciliation** detail page.

## Overview

- The **Deposit Status** pill in the **Deposit Line Items** table is display-only (read-only).
- Matching is applied via the **Match** button in the **Suggested Matches – Revenue Schedules** header (left of the search input).
- Unmatching is applied via the **Mark Unmatched** bulk action on the **Deposit Line Items** table.

## User Behavior

### Apply a match

1. Select a deposit line item in the **Deposit Line Items** table.
2. Select exactly one schedule in **Suggested Matches – Revenue Schedules**.
3. Click **Match**.
4. The UI shows **Updating...** while the request runs; on success, a toast confirms the match.

### Unmatch

1. Select a matched (or partially matched) deposit line item.
2. Click the **Mark Unmatched** bulk action.

## Enable/Disable Rules

The **Match** button is disabled when:

- No deposit line item is selected.
- No suggested schedule is selected, or more than one is selected.
- The selected line item is **Reconciled** or **Ignored**.
- A match/unmatch request is currently in-flight.

## Implementation Notes (Code References)

- `components/deposit-reconciliation-detail-view.tsx`
  - Renders the **Match** button via `ListHeader` `preSearchAccessory` for the schedules table.
  - Keeps the status pill renderer read-only while preserving per-row in-flight text (**Updating...**).
  - Matching handler: `handleRowMatchClick`.

## API Endpoints

- `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match`
  - Source: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts`
- `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch`
  - Source: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts`
