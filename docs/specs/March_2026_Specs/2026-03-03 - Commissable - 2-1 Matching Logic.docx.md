**COMMISSABLE**

**2-to-1 Deposit Matching: Reconciliation Logic**

Deposit Reconciliation · v1.0 Specification

*Scenario: 2 deposit line items → 1 bundled expected revenue schedule*

## **Overview**

When a user attempts a 2:1 mapping — reconciling two deposit line items against a single bundled opportunity product — the system must evaluate whether those deposits share the same commission rate before applying any changes. The outcome forks into two distinct paths:

| Path | Trigger Condition |
| :---- | :---- |
| **Case 1 — Approve & Apply** | Both deposit lines share the same commission % |
| **Case 2 — Split & Rebuild** | Deposit lines carry different commission rates |

## **Commission Rate Check (Entry Point)**

Before any user prompt is shown, the system automatically performs the following check:

1. User initiates a 2:1 mapping attempt from the reconciliation interface.

2. System retrieves the commission % from both deposit line items.

3. System compares the two rates.

Example:

* Deposit Line A \= 12%, Deposit Line B \= 12% → Rates match → Case 1

* Deposit Line A \= 12%, Deposit Line B \= 15% → Rates differ → Case 2

## **Case 1 — Rates Match: Approve & Apply**

**Step 1 — Approval Prompt**

The system displays an approval modal to the user showing:

* Both deposit line items (name, qty, MRC, commission %)

* Combined totals (total MRC, total commission/mo)

* All metadata fields that will be written to CRM objects

| Example System Prompt (Case 1\) *Deposit Lines A and B both carry a 12% commission rate and can be combined into* *Product X. Combined MRC: $850. Total commission: $102/mo. Approve this mapping?* |
| :---- |

**Step 2 — On User Approval: CRM Updates**

Upon confirmation, the system updates all three CRM objects simultaneously:

| CRM Object | Fields Updated |
| :---- | :---- |
| **Revenue Schedule** | Mark schedule as Reconciled · Apply actual usage from both deposits · Set commission paid amount · Add deposit source references to notes |
| **Account Object** | Update MRC/ARR actuals · Set reconciled status flag · Set last reconciled date |
| **Opportunity** | Update opp product line with actual billed amounts · Log reconciliation event in activity history |

**Auto-Generated Schedule Note (Case 1\)**

| Example Note Written to Revenue Schedule *Reconciled 06/01/2026 — mapped from Deposit Lines A (\#DEP-1042) and B (\#DEP-1043).* *Combined billed MRC $850. Commission applied at 12%.* |
| :---- |

## **Case 2 — Rate Mismatch: Split & Rebuild**

**Step 1 — Mismatch Notification**

The system immediately blocks the mapping and presents a clear explanation to the user:

| Example System Message (Case 2\) *These two deposit lines cannot be combined into a single revenue schedule.* *Deposit A carries a 12% commission rate while Deposit B carries 15%.* *A single bundled product cannot apply two different pay rates accurately.* |
| :---- |

**Step 2 — Prompt: Remove Original Opportunity Product**

The system prompts the user to remove the existing bundled product and its related revenue schedules. The following details are displayed for confirmation:

* Product name (e.g., “Product X”)

* Schedule date range (e.g., 01/01/2026 – 12/01/2026)

* Number of monthly periods (e.g., 12\)

* Current expected commission value

**Step 3 — Propose Two Replacement Opportunity Products**

The system proposes two new opportunity products, each sourced directly from the deposit data:

| New Product A | New Product B |
| :---- | :---- |
| Name from deposit data | Name from deposit data |
| Qty · Price per unit (from deposit) | Qty · Price per unit (from deposit) |
| Commission rate: 12% | Commission rate: 15% |
| Periods: Jan 2026 – Dec 2026 (12 mo) | Periods: Jan 2026 – Dec 2026 (12 mo) |

**Step 4 — Create New Revenue Schedules**

For each replacement product, the system generates a new set of revenue schedules:

* Same number of periods as original Product X

* Same start and end dates as original Product X

* Each schedule tied to its respective new opportunity product

* Commission rate correctly reflects the individual product rate

**Step 5 — Delete Original Product X and Schedules**

Once the replacement products and schedules are confirmed, the system removes:

* All expected monthly revenue schedule records tied to Product X (e.g., 12 records)

* The original Product X opportunity product line

Note: A soft-delete / archive is recommended over hard delete to preserve a rollback path.

**Step 6 — Auto-Generated Revenue Schedule Note (Case 2\)**

The system writes a plain-English explanation into the Revenue Schedule Notes field. This note also serves as the audit trail.

| Example Note Written to Revenue Schedule *Product X (01/01/2026–12/01/2026, 12 periods) was removed during reconciliation* *because the two underlying deposit lines carried different commission rates (12% and 15%)* *and could not be combined. Two replacement products were created — \[Product A Name\]* *at 12% and \[Product B Name\] at 15% — each with its own revenue schedule spanning the* *same date range. Original expected schedules deleted 06/01/2026.* |
| :---- |

## **Implementation Notes**

* Soft delete recommended for original schedules to preserve rollback capability

* The approval prompt (Case 1\) should display a preview of all metadata being written before the user confirms — preventing incorrect mappings across 3 CRM objects

* The Case 2 note should also be logged to the Opportunity activity history, not just the schedule note field

* Product names for replacements should auto-populate from deposit data to reduce manual entry

Commissable, Inc. · Deposit Reconciliation Logic · v1.0 · Confidential

