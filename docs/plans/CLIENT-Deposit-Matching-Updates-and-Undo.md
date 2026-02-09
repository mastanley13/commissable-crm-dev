# Client Explainer: How Deposit Matching Updates Your CRM (and What Undo Does)

Last updated: 2026-02-09

## Why this exists

When you "match" a deposit line to a revenue schedule, the system does two things:

1. Reconciles money: it applies the deposit dollars/usage to the right expected schedules.
2. Improves data quality: it can fill in missing identifiers (only when blank) so future matching is faster and more accurate.

This document explains what changes happen, and what Undo is expected to reverse.

## Key terms (plain language)

- Deposit: the monthly payout/report you upload (a batch).
- Deposit line item: one row from the deposit (e.g., one customer/product line).
- Revenue schedule: the "expected" monthly line we are trying to get paid for.
- Opportunity: the sales record that owns the deal (customer/order identifiers often live here).
- Product catalog: your master list of products (including vendor part numbers and vendor naming).

## Big picture flow (what updates what)

```
Uploaded Deposit File
        |
        v
     Deposit
        |
        v
 Deposit Line Items (rows)
        |
        v
  Match / Allocate to
  Revenue Schedule(s)
    |            |
    |            +------------------------------+
    |                                           |
    v                                           v
Revenue Schedules get                      Helpful "Auto-Fill"
Actuals + Status updated                   (only fills blanks)
    |                                           |
    v                                           v
Deposit totals/progress updated           Opportunity + Product Catalog
                                          get missing IDs/aliases filled
```

## What changes when you apply a match

### A) Allocation is recorded (the "who paid what" record)

The system stores the allocation between:

- the deposit line item (what you received), and
- the revenue schedule(s) (what you expected).

This supports:

- 1 line -> 1 schedule (most common)
- 1 line -> many schedules (split payments/prepayments)
- many lines -> 1 schedule (multiple payments toward one expectation)

### B) Revenue schedules update their "actual" numbers and status

After allocation, the revenue schedule recalculates:

- Actual Usage
- Actual Commission
- Status (examples: unreconciled, reconciled, underpaid, overpaid)

This is computed from the applied deposit allocations (it is not a manual freehand number).

### C) Deposit and deposit-line progress updates

The deposit line item updates to show:

- matched / partially matched / unmatched
- allocated vs unallocated amounts

The deposit (batch) also updates totals so you can see overall progress for the month.

### D) Data propagation ("auto-fill") to improve future matching

If the matched schedule is linked to an Opportunity and a Product, the system may copy in missing identifiers:

Opportunity (IDs that help matching):

- Vendor Account ID(s)
- Vendor Customer ID(s)
- Vendor Order ID(s)

Product Catalog (aliases that help matching):

- Vendor Product Name (alias)
- Vendor Part Number(s) / aliases

Important rules:

- No overwrite: if the Opportunity/Product already has a value, matching will not replace it.
- Fill blanks only: auto-fill runs only for empty fields.
- Audit trail: these auto-filled changes are tagged so admins can review and revert them safely.

## What "Undo" must reverse (the contract)

When you undo a match, the goal is to put the system back to the same state as before that match was applied, without destroying later user edits.

### Undo must reverse these effects

- Remove the allocation(s) that were applied by that match action.
- Recompute the revenue schedule actuals/status based on remaining allocations (if any).
- Recompute deposit line and deposit totals/status.
- Revert any auto-filled Opportunity/Product Catalog fields created by that match action, but only if it is still safe to do so.
- Keep a permanent audit trail of:
  - what was undone,
  - who did it,
  - and any fields that could not be reverted due to conflicts.

### Undo must be safety-first

Undo should not clobber newer edits. If someone changes a field after auto-fill (for example, they manually corrected a vendor part number), Undo should leave that newer edit intact and report a "conflict" instead of forcing a rollback.

## Practical scenarios (examples)

### Example 1: Simple 1:1 match

You match a deposit line for $120 to an expected schedule for $120.

- Schedule actual commission becomes $120 and status becomes "reconciled" (or equivalent).
- Deposit line becomes "matched".
- If the Opportunity is missing a Vendor Customer ID and the deposit line had it, the system fills it (but only if blank).

Undo should:

- remove that $120 allocation,
- recompute schedule back to the prior state,
- set the deposit line back to unmatched/partially matched as appropriate,
- and revert the auto-filled Opportunity ID if it has not been edited since.

### Example 2: One deposit line split across many schedules (match group)

You match a $1,440 prepayment across 12 schedules ($120 each).

Undo should:

- undo the entire set as a single unit (so you do not have to undo 12 separate pieces),
- recompute all 12 schedules and the deposit totals,
- and revert any auto-filled IDs/aliases that were added as part of that apply.

## Notes on current behavior (what you will see)

- There is an admin "History -> Undo" action for auto-filled Opportunity/Product fields. It is field-safe and conflict-aware.
- Some undo actions are grouped (undo the whole match group); some actions remove allocations at the line level.
- The product goal is consistent: undo should remove allocations and safely roll back any side-effect auto-fill created by the match, while preserving later manual corrections.
