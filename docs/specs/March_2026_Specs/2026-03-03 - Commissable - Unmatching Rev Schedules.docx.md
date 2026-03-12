**Deposit Unmatch Reversal**

Requirements for Complete State Rollback on Unmatch

Commissable, Inc.  |  Version 1.0  |  March 2026

# **1\. Problem Statement**

When a matched deposit line and its corresponding revenue schedule are "unmatched" (due to a correction, error, or reassignment), the system must fully reverse every change that was made during the original match process. Currently, the system is not completely unwinding all modifications — specifically, when a deposit amount exceeds the expected usage and the system auto-adjusts, that adjustment is not being removed upon unmatch.

This creates orphaned data: revenue schedules carry stale adjustments, opportunity details reflect incorrect totals, and catalog entries retain overwritten values. The result is corrupted financial data that compounds with each subsequent reconciliation cycle.

| ⚠  KNOWN BUG: When a deposit exceeds expected usage and the system auto-adjusts the schedule, unmatching the deposit does not reverse the adjustment. The schedule retains the inflated usage/commission values. This must be fixed as the highest-priority item in this spec. |
| :---- |

# **2\. Scope of Reversal**

When a deposit line is unmatched from a revenue schedule, the system must reverse every downstream effect as if the match never occurred. The reversal scope spans six areas:

| \# | Area | What Must Be Reversed |
| :---- | :---- | :---- |
| **1** | **Revenue Schedule (Current)** | Actual Usage, Actual Commission, Usage Adjustment, Commission Adjustment, any auto-adjustment made when the deposit exceeded the expected amount. All values return to their pre-match state. |
| **2** | **Revenue Schedule Metadata** | Status reverts from "Reconciled" to "Unreconciled." Any metadata stamps (matched date, matched by user, deposit reference ID) are cleared. Any order ID’s, new fields created and its values, and other ID’s.  |
| **3** | **Adjacent Schedules** | If the match process updated prior or future schedules (e.g., spreading an overage, updating running balances, or adjusting cumulative commission fields), those changes must also be reversed. |
| **4** | **Opportunity Details** | Any rollup fields on the parent Opportunity or Opportunity Product (total actual commission, total actual usage, reconciliation status) must be recalculated to exclude the unmatched schedule’s contribution. |
| **5** | **Product Catalog** | If the match process wrote "Other – Product Name," "Other – Part Number," or "Other – Product Description" back to the catalog, those values must be reverted to their pre-match state. |
| **6** | **Deposit Line** | The deposit line’s status reverts from "Matched" / "Reconciled" to "Unmatched." Its reference to the revenue schedule is cleared. |

# **3\. Detailed Reversal Checklist**

## **3.1 Revenue Schedule Fields (Current Schedule)**

Every field touched during the match must revert to its pre-match value:

* Actual Usage → revert to pre-match value (typically $0.00 or prior value)

* Actual Commission → revert to pre-match value

* Usage Adjustment → revert to $0.00 (or prior value)

* Commission Adjustment → revert to $0.00 (or prior value)

* Auto-adjustment from deposit overage → MUST be fully reversed (this is the current bug)

* Matched Deposit Reference → clear

* Matched Date / Matched By → clear

* Status → set to "Unreconciled"

## **3.2 Adjacent Schedules (Prior & Future)**

If the reconciliation engine touched any schedule other than the one being unmatched:

* Prior schedules: Reverse any retroactive adjustments (e.g., catch-up calculations, cumulative true-ups)

* Future schedules: Reverse any forward-looking adjustments (e.g., projected commission updates, balance carry-forwards)

* Metadata on adjacent schedules (if stamped during the match): clear any reference to the deposit or reconciliation event

## **3.3 Opportunity & Opportunity Product**

* Recalculate total Actual Usage on the Opportunity Product (exclude the unmatched schedule’s contribution)

* Recalculate total Actual Commission on the Opportunity Product

* Recalculate any rollup or summary fields on the parent Opportunity

* If the Opportunity’s reconciliation status was derived from child schedule statuses, re-evaluate it

## **3.4 Product Catalog**

During reconciliation, the system may overwrite catalog fields with deposit-derived values. On unmatch:

* "Other – Product Name" → revert to previous catalog value

* "Other – Part Number" → revert to previous catalog value

* "Other – Product Description" → revert to previous catalog value

| IMPORTANT: The system must store the original catalog values before overwriting them during match. Without a snapshot of the pre-match catalog state, reversal is impossible. See Section 5 for the proposed tracking mechanism. |
| :---- |

## **3.5 Deposit Line**

* Status → set to "Unmatched"

* Revenue Schedule reference → clear

* Any metadata linking it to the schedule (match timestamp, matched by user) → clear

## **3.6 Upload-Level Status**

If unmatching a single deposit line breaks a fully-reconciled upload:

* Upload status → reverts from "Reconciled" to "Unreconciled"

* All other deposit lines in the upload that are still matched remain "Matched" — they are NOT unmatched

* The upload cannot return to "Reconciled" until all deposit lines are re-matched and the user manually reconciles/finalizes

# **4\. Status Flow on Unmatch**

The following diagram shows how statuses change when a single deposit line is unmatched from a fully reconciled upload:

| Entity | Before Unmatch | After Unmatch | Notes |
| :---- | :---- | :---- | :---- |
| **Unmatched Deposit Line** | Reconciled | **Unmatched** | Fully cleared |
| **Unmatched Schedule** | Reconciled | **Unreconciled** | All values reverted |
| **Other Deposit Lines** | Reconciled | **Matched** | Downgraded from Reconciled → Matched; data intact |
| **Other Schedules** | Reconciled | **Matched** | Downgraded from Reconciled → Matched; data intact |
| **Upload** | Reconciled | **Unreconciled** | Cannot re-reconcile until all lines re-matched \+ user finalizes |

# **5\. Proposed Tracking Mechanism: Match Snapshot Ledger**

To reliably reverse every change, the system needs a record of what changed during each match event. We propose a Match Snapshot Ledger — a log table that captures the before-state of every field modified during a match.

## **5.1 Ledger Structure**

| Field | Type | Description |
| :---- | :---- | :---- |
| **snapshot\_id** | UUID | Primary key |
| **match\_event\_id** | UUID | Groups all changes from a single match operation |
| **entity\_type** | ENUM | revenue\_schedule | deposit\_line | opportunity | opportunity\_product | catalog\_product |
| **entity\_id** | UUID | The ID of the specific record that was modified |
| **field\_name** | VARCHAR | The name of the field that was changed (e.g., "actual\_usage", "other\_product\_name") |
| **value\_before** | TEXT | The field’s value immediately before the match was applied (serialized) |
| **value\_after** | TEXT | The field’s value after the match was applied (for audit purposes) |
| **created\_at** | TIMESTAMP | When the match event occurred |
| **created\_by** | UUID | The user who performed the match |

## **5.2 How It Works**

1. MATCH: Before writing any changes during a match operation, the system captures a snapshot of every field it is about to modify. Each snapshot row is tagged with the same match\_event\_id.

2. UNMATCH: When a user triggers an unmatch, the system queries the ledger for all rows with the corresponding match\_event\_id, then restores each field to its value\_before. The snapshot rows are then soft-deleted or marked as "reversed."

3. AUDIT: The ledger serves as a full audit trail. Even after reversal, the history of what was changed and when is preserved for compliance and debugging.

| The Match Snapshot Ledger solves the core tracking problem: the system no longer needs to "guess" what to reverse. It has an explicit, field-level record of every pre-match value. This also covers edge cases like partial overages, multi-schedule adjustments, and catalog overwrites. |
| :---- |

# **6\. Re-Match & Finalization Workflow**

After an unmatch, the system returns to a state where the deposit line is available for re-matching. The workflow is:

4. Unmatch is performed. All reversals from Sections 2–3 are executed. Statuses update per Section 4\.

5. The deposit line appears in the unmatched queue, available to be matched to the same or a different revenue schedule.

6. The user (or auto-match engine) re-matches the deposit line. A new match\_event\_id is created, and new snapshots are captured.

7. Once ALL deposit lines in the upload are matched, the user can initiate reconciliation.

8. The user reviews the reconciliation summary and clicks Finalize/Reconcile to lock the upload.

9. Upload status → "Reconciled." All child deposit lines and their matched schedules → "Reconciled."

# **7\. Acceptance Criteria**

The unmatch feature is complete when the following criteria are met:

| \# | Criterion |
| :---- | :---- |
| **1** | Unmatching a deposit line fully reverses Actual Usage, Actual Commission, Usage Adjustment, and Commission Adjustment on the matched schedule — including auto-adjustments from deposit overages. |
| **2** | Metadata on the current schedule (matched date, matched by, deposit reference) is cleared. |
| **3** | Any changes made to prior or future schedules during the original match are fully reversed. |
| **4** | Opportunity and Opportunity Product rollup fields are recalculated to exclude the unmatched schedule. |
| **5** | Catalog fields (Other – Product Name, Part Number, Description) are reverted to their pre-match values. |
| **6** | The deposit line status reverts to "Unmatched" with all references cleared. |
| **7** | The unmatched schedule status reverts to "Unreconciled." |
| **8** | Other matched deposits/schedules in the upload remain "Matched" (not unmatched), but the upload status reverts to "Unreconciled." |
| **9** | The upload cannot be re-reconciled until all deposit lines are re-matched and the user manually finalizes. |
| **10** | A Match Snapshot Ledger (or equivalent tracking mechanism) captures the before-state of every modified field at match time, enabling reliable reversal. |

