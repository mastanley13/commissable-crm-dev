# How Matching Works — Client Guide

> A plain-language explanation of what happens when you match a deposit line
> to a revenue schedule, and what "Undo" rolls back.

---

## What Is Matching?

Matching is the process of connecting a line from a vendor deposit file (the money
you actually received) to a revenue schedule (the money you expected to receive).

When a match is made, the system automatically updates several related records so
that your data stays consistent across the board — from the deposit file all the
way through to your opportunities and product catalog.

---

## The Ripple Effect: What Happens When You Match

Think of matching like dropping a stone into a pond. The match itself is the
stone, and the ripples spread outward to update related records automatically.

```
                         YOU APPLY A MATCH
                               |
                               v
                    +---------------------+
                    |   Deposit Line      |
                    |   Match Created     |
                    +---------------------+
                               |
              +----------------+----------------+
              |                                 |
              v                                 v
   +---------------------+          +---------------------+
   |   Deposit Line      |          |  Revenue Schedule   |
   |   Item Updated      |          |  Updated            |
   |                     |          |                     |
   | - Allocated amounts |          | - Actual amounts    |
   | - Status changes    |          | - Status changes    |
   +---------------------+          +---------------------+
              |                                 |
              v                                 |
   +---------------------+           +---------+---------+
   |   Deposit File      |           |                   |
   |   Totals Updated    |           v                   v
   |                     |  +----------------+  +----------------+
   | - Overall progress  |  |  Opportunity   |  |  Product       |
   | - Summary counts    |  |  Updated       |  |  Catalog       |
   +---------------------+  |                |  |  Updated       |
                             | - Vendor IDs   |  |                |
                             |   filled in    |  | - Vendor name  |
                             +----------------+  | - Part number  |
                                                 +----------------+
```

Here is what each layer does:

### 1. The Match Record

A new record is created that links the deposit line to the revenue schedule.
It stores:
- How much usage (revenue) is being allocated
- How much commission is being allocated
- Whether it was matched by you manually or suggested by the system

### 2. Deposit Line Item

The deposit line's numbers are updated to reflect the match:
- **Allocated amounts** — how much of the line's usage and commission has been
  accounted for
- **Unallocated amounts** — how much is still unmatched
- **Status** — changes to "Matched" (fully allocated), "Partially Matched"
  (some allocated), or stays "Unmatched" (nothing allocated)

### 3. Revenue Schedule

The revenue schedule's actual amounts are recalculated:
- **Actual Usage** — the total usage received from all matched deposit lines
- **Actual Commission** — the total commission received from all matched lines
- **Status** — changes based on how actuals compare to expectations:

```
  Expected vs. Actual Comparison
  ==============================

  Expected:  $1,000          Expected:  $1,000          Expected:  $1,000
  Actual:    $1,000          Actual:      $750          Actual:    $1,200
             ------                     ------                     ------
  Balance:      $0           Balance:     $250          Balance:    -$200
  Status:  RECONCILED        Status:  UNDERPAID         Status:  OVERPAID
              [OK]              [NEEDS ATTENTION]          [NEEDS ATTENTION]
```

A small variance tolerance (configurable in your settings) allows for minor
rounding differences without flagging the schedule as underpaid or overpaid.

### 4. Deposit File Totals

The parent deposit file's summary numbers are refreshed:
- Total usage and commission across all lines
- How much is allocated vs. unallocated
- How many lines are matched, partially matched, or still unmatched
- Overall deposit status (Pending, In Review, or Completed)

### 5. Opportunity (Vendor IDs)

If the opportunity linked to the revenue schedule is missing certain vendor
identifiers, the system automatically fills them in from the deposit line:

| Field Filled | What It Is |
|---|---|
| Vendor Account ID | The vendor's account identifier |
| Vendor Customer ID | The vendor's customer identifier |
| Vendor Order ID | The vendor's order or transaction identifier |

**Important:** These fields are only filled in if they are currently blank.
If you have already entered a value, the system will not overwrite it.

### 6. Product Catalog (Vendor Info)

Similarly, if the product linked through the revenue schedule is missing vendor
details, the system fills them in:

| Field Filled | What It Is |
|---|---|
| Vendor Product Name | The product name as it appears in the vendor's system |
| Vendor Part Number | The part/SKU number from the vendor's system |

Again, these are only filled in if currently blank — existing values are never
overwritten.

---

## What Happens When You Undo a Match

Undo reverses the ripple effect, restoring records to their state before the
match was applied.

```
  BEFORE MATCH          MATCH APPLIED           UNDO
  ============          =============           ====

  Deposit Line          Deposit Line            Deposit Line
  Status: Unmatched     Status: Matched    -->  Status: Unmatched
  Allocated: $0         Allocated: $500         Allocated: $0
  Unallocated: $500     Unallocated: $0         Unallocated: $500

  Revenue Schedule      Revenue Schedule        Revenue Schedule
  Actual: $0            Actual: $500       -->  Actual: $0
  Status: Unreconciled  Status: Reconciled      Status: Unreconciled

  Opportunity           Opportunity             Opportunity
  Vendor Acct: (empty)  Vendor Acct: V-1234 --> Vendor Acct: (empty)

  Product               Product                 Product
  Vendor Name: (empty)  Vendor Name: Widget --> Vendor Name: (empty)
```

### What Undo Reverts — Summary

| What | Reverted? | Detail |
|---|---|---|
| Match record | Yes | Deleted entirely |
| Deposit line allocated amounts | Yes | Recalculated (back to zero if no other matches) |
| Deposit line status | Yes | Returns to Unmatched (or Partially Matched if other matches exist) |
| Revenue schedule actual amounts | Yes | Recalculated from remaining matches |
| Revenue schedule status | Yes | Recalculated (may return to Unreconciled) |
| Deposit file totals | Yes | Recalculated from all lines |
| Opportunity vendor IDs | Yes | Restored to previous value (see note below) |
| Product vendor name / part number | Yes | Restored to previous value (see note below) |

### A Note on Opportunity and Product Undo

The system tracks what was auto-filled and what the previous value was. When you
undo:

- **If no one has changed the field since it was auto-filled**, the system
  restores it to what it was before (usually blank).

- **If someone has manually edited the field after it was auto-filled**, the
  system will detect the conflict and **leave the manual edit in place**. It
  will not overwrite your manual changes.

This protects your team's work — if someone corrected a vendor ID after the
auto-fill, undo won't erase that correction.

---

## Match Types

Matches can be applied in different configurations depending on your data:

```
  ONE-TO-ONE                 ONE-TO-MANY               MANY-TO-ONE
  ============               ============              ============

  +--------+                 +--------+                +--------+
  | Line 1 |----->[ Sched ]  | Line 1 |-+--->[ Sch A ] | Line 1 |--+
  +--------+                 +--------+ |              +--------+  |
                                        +--->[ Sch B ] | Line 2 |--+--->[ Sched ]
                                        |              +--------+  |
                                        +--->[ Sch C ] | Line 3 |--+
                                                       +--------+

  1 deposit line matched     1 deposit line split      Multiple deposit lines
  to 1 revenue schedule      across multiple           combined into 1 revenue
                             revenue schedules         schedule
```

- **One-to-One** — The most common case. One deposit line maps to one revenue schedule.
- **One-to-Many** — A single deposit line covers multiple revenue schedules
  (e.g., a prepayment that spans several billing periods).
- **Many-to-One** — Multiple deposit lines contribute to a single revenue
  schedule (e.g., partial payments received over time).
- **Many-to-Many** — A combination of the above for complex scenarios.

---

## Frequently Asked Questions

**Q: Will matching overwrite data I've already entered?**
No. Auto-fill only populates fields that are currently blank. Your existing data
is never overwritten.

**Q: What if I undo a match but someone already updated the vendor ID?**
The system detects this and leaves the updated value in place. It will not erase
manual edits made after the auto-fill.

**Q: Does the deposit automatically complete when all lines are matched?**
No. When all lines are matched, the deposit moves to "In Review" status. You
must explicitly finalize the deposit to mark it as "Completed."

**Q: Can I undo a match after the deposit has been finalized?**
No. Once a deposit is finalized and lines are reconciled (locked), matches
cannot be undone.

**Q: What happens to the revenue schedule if I undo the only match it had?**
It returns to "Unreconciled" status with actual amounts reset to zero (or
whatever remains from other matches, if any).

**Q: How does the system decide if a schedule is Reconciled vs. Underpaid?**
It compares the expected amounts to the actual matched amounts. If the
difference falls within your configured variance tolerance, it's considered
Reconciled. Otherwise, it's marked Underpaid or Overpaid depending on the
direction.
