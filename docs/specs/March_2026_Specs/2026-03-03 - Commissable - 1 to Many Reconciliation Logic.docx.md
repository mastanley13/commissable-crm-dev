**COMMISSABLE**

**1-to-2 Deposit Matching: Reconciliation Logic**

Deposit Reconciliation · v1.0 Specification

*Scenario: 1 deposit line item → 2 expected revenue schedules (from 2 opportunity products)*

# **Overview**

When a single deposit line item from a vendor payment must be reconciled against two separate opportunity products (each with its own revenue schedule), the system evaluates whether the deposit contains granular breakdown data for each product. The outcome forks into three distinct paths:

| Path | Trigger Condition |
| :---- | :---- |
| **Case 1 — Breakdown Available** | Deposit includes line-level detail (usage \+ commission per product) |
| **Case 2 — No Breakdown, Split Possible** | Deposit is a single lump sum but commission rates differ across products |
| **Case 3 — No Breakdown, Consolidate** | User elects to merge products into a single product for simplified matching |

# **Deposit Analysis (Entry Point)**

Before any user prompt is shown, the system automatically inspects the deposit:

1. User initiates a 1:2 mapping attempt from the reconciliation interface.

2. System retrieves the deposit line item and the two target opportunity products with their respective revenue schedules.

3. System checks whether the deposit file contains line-level breakdown data (e.g., separate usage and commission amounts per product).

4. Based on the result, the system routes to Case 1, Case 2, or presents a consolidation option (Case 3).

| Example: *Deposit \#DEP-2087: $1,200 total commission payment.* *Opportunity has Product A (usage: $5,000, rate: 12%) and Product B (usage: $3,000, rate: 15%).* *If deposit file breaks this into $600 \+ $450 → Case 1\.* *If deposit is a single $1,200 line → Case 2 or Case 3\.* |
| :---- |

# **Case 1 — Breakdown Available: Map & Apply**

## **Step 1 — System Suggestion Prompt (First Occurrence)**

When the system detects line-level breakdown data in the deposit, it presents a suggested allocation to the user for approval. This happens only on the first match attempt for this deposit/product pairing.

| Example System Prompt (Case 1\) *Deposit \#DEP-2087 contains breakdown data for 2 products:*   *Product A — Usage: $5,000 | Commission: $600 (12%)*   *Product B — Usage: $3,000 | Commission: $450 (15%)* *Suggested mapping:*   *$600 → Product A Revenue Schedule (June 2026\)*   *$450 → Product B Revenue Schedule (June 2026\)* *Approve this allocation?* |
| :---- |

## **Step 2 — On Approval: Metadata Propagation**

Upon user confirmation, the system does two things simultaneously:

* Applies the deposit amounts to the current period’s revenue schedules for both products.

* Writes deposit metadata (vendor product identifiers, usage fields, commission fields) to ALL schedules for each respective product — past, present, and future.

| CRM Object | Fields Updated |
| :---- | :---- |
| **Revenue Schedule (Current)** | Mark as Reconciled · Apply actual usage & commission from deposit breakdown · Set deposit source reference |
| **Revenue Schedule (All Others)** | Propagate deposit metadata fields (vendor product ID, usage field mapping, commission field mapping) to enable automatic 1:1 matching on future deposits |
| **Account Object** | Update MRC/ARR actuals · Set reconciled status flag · Set last reconciled date |
| **Opportunity** | Update opportunity product lines with actual billed amounts · Log reconciliation event |

## **Step 3 — Automatic Matching on Subsequent Deposits**

Because metadata has been written to all schedules for each product, the next deposit file that arrives with the same breakdown structure will match automatically 1:1 — Product A’s line maps to Product A’s schedule, Product B’s line maps to Product B’s schedule. No user intervention required.

| Auto-Generated Revenue Schedule Note (Case 1\) *Reconciled 06/01/2026 — Deposit \#DEP-2087 allocated across 2 products.* *Product A: Usage $5,000, Commission $600 at 12%.* *Product B: Usage $3,000, Commission $450 at 15%.* *Metadata propagated to all schedules for automatic future matching.* |
| :---- |

# **Case 2 — No Breakdown, Split Possible**

When the deposit is a single lump-sum line with no per-product breakdown, but the two opportunity products have different commission rates, the system needs the user’s help to determine how the payment splits across products.

## **Step 1 — Prompt: Identify Product Allocation**

The system presents the lump deposit alongside the two expected products and asks the user to confirm or adjust how the total should be divided.

| Example System Prompt (Case 2\) *Deposit \#DEP-2087 is a single line: $1,050 total commission.* *Your opportunity expects 2 products with different rates:*   *Product A — Expected usage: $5,000 at 12% \= $600/mo*   *Product B — Expected usage: $3,000 at 15% \= $450/mo*   *Combined expected: $1,050* *Suggested split based on expected values:*   *$600 → Product A | $450 → Product B* *Accept this split, adjust manually, or consolidate into one product?* |
| :---- |

## **Step 2 — On Approval: Apply & Propagate Metadata**

Once the user confirms (or adjusts) the split, the same metadata propagation from Case 1 applies:

* Current schedules are reconciled with the user-confirmed amounts.

* Metadata is written to ALL schedules (past, present, future) for each product.

* Future deposits with the same lump-sum structure will attempt automatic splitting using the stored ratios and metadata.

## **Step 3 — Future Matching Behavior**

On subsequent deposits, the system uses the confirmed split ratio and metadata to automatically allocate the lump-sum payment across the two products. If the total changes but the ratio holds, matching proceeds automatically. If the ratio appears to have shifted beyond a configurable tolerance, the system flags it for user review.

# **Case 3 — No Breakdown, Consolidate Products**

When deposit breakdown data is not available and the user prefers simplicity over granularity, the system offers the option to merge the two (or more) opportunity products and their schedules into a single consolidated product.

## **Step 1 — Consolidation Prompt**

The system presents the option to remove the individual products and replace them with a single product that carries forward the combined usage and a blended commission rate.

| Example System Prompt (Case 3\) *Deposit \#DEP-2087 is a single line with no product-level breakdown.* *You can consolidate Product A and Product B into a single product:*   *Combined usage: $8,000 ($5,000 \+ $3,000)*   *Blended commission: $1,050/mo (effective rate: 13.125%)* *This will remove Product A and Product B and their schedules,* *and create one new product with matching revenue schedules.* *Proceed with consolidation?* |
| :---- |

## **Step 2 — Remove Original Products & Schedules**

Upon confirmation, the system soft-deletes:

* Product A and all of its revenue schedule records.

* Product B and all of its revenue schedule records.

## **Step 3 — Create Consolidated Product & Schedules**

The system creates a single replacement opportunity product:

* Product name auto-generated or user-specified (e.g., “Product A \+ B Consolidated”).

* Total usage: Sum of original products’ usage.

* Commission rate: Blended rate based on total commission / total usage.

* Revenue schedules generated for the same date range and number of periods as the originals.

## **Step 4 — Apply Metadata & Match**

The deposit metadata is written to the new consolidated product’s schedules. Because there is now a single product matching a single deposit line, all future deposits match 1:1 automatically.

| Auto-Generated Revenue Schedule Note (Case 3\) *Products A and B consolidated into “Product A \+ B Consolidated” on 06/01/2026.* *Original products soft-deleted (archive IDs: \#PROD-401, \#PROD-402).* *Combined usage: $8,000. Blended commission rate: 13.125% ($1,050/mo).* *New schedules created for 01/2026–12/2026 (12 periods).* *Metadata applied to all schedules for automatic future matching.* |
| :---- |

# **Implementation Notes**

* Metadata propagation is the key mechanism: once the user confirms a mapping, the system writes vendor-specific identifiers to ALL schedules for that product, enabling automatic matching going forward.

* Soft delete is recommended for all removed products and schedules to preserve rollback capability.

* The Case 2 split ratio should be stored as a reconciliation rule so the system can auto-apply it to future lump-sum deposits.

* Case 3 consolidation should log the original product IDs in the new product’s notes for audit trail purposes.

* All approval prompts should display a full preview of metadata being written before confirmation.

* Reconciliation notes should also be logged to the Opportunity activity history, not just the schedule note field.

* Consider a configurable tolerance threshold (e.g., ±5%) for Case 2 auto-matching when deposit amounts shift slightly between periods.

Commissable, Inc. · 1-to-2 Deposit Reconciliation Logic · v1.0 · Confidential