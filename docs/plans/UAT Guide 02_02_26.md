According to a document from **February 2, 2026**, here’s a **plain‑language UAT runbook** you can follow to test the **FLEX** \+ **Chargeback** workflows end‑to‑end, **plus the other highest‑priority (P0/P1) items** called out across the Jan 21/22/26 meeting notes, the Milestone 3 specs, and the frozen-columns alignment outline.

---

## **UAT goal**

By the end of this runbook, you should be able to demonstrate:

1. A deposit file can be uploaded (CSV/XLSX, and PDF if enabled), mapped, validated, and turned into a Deposit \+ Deposit Line Items.  
2. The reconciliation workbench can:  
* suggest matches (with confidence),  
* support multi-select,  
* handle 1:1 and guide users through non‑1:1 matches,  
* and correctly update schedule values \+ statuses.  
3. Exceptions are handled:  
* **FLEX schedules** are created for overage/unmatched scenarios (tagged “-F”).  
* **Chargebacks** create **Chargeback schedules** (tag “-CB”), and **Reversals** create “-CB-REV”.  
4. Chargebacks specifically require:  
* “**In Dispute**” status labeling (vs “Pending”),  
* and a **manager approval** workflow (approve/reject).

---

## **Who should participate (roles)**

You’ll get the best coverage if you can log in as at least:

* **Reconciler / Accounting user**: does upload \+ matching day-to-day  
* **Admin**: can edit protected fields (ex: “Received By”), edit ID lists, manage templates (ASSUMED where not yet role-locked)  
* **Manager**: can approve/reject chargebacks and perform “Undo” (manager-level undo is explicitly required).

---

## **Test data you should have ready (simple checklist)**

You do **not** need perfect “real” vendor files to run UAT, but you do need test cases that drive each workflow. Aim to prepare:

### **A. Revenue Schedules exist**

Create at least 1 Opportunity/Product that produces monthly schedules (so there is something to match against). Schedules should have RS-style IDs (example format: `RS-100001`).

### **B. Deposit files / deposit lines for these scenarios**

Try to have at least one line item for each:

1. **Exact / high-confidence match** (should be suggested or auto-applied depending on config)  
2. **Fuzzy match** (name slightly off, but still within thresholds)  
3. **No match** (should create FLEX schedule under your rules)  
4. **Overage / Overpaid** (expected $X, paid $X \+ extra → FLEX)  
5. **Underpaid** (expected $X, paid less; triggers “Underpaid” and should support a collections flow)  
6. **Chargeback** (negative amount)  
7. **Chargeback reversal** (a later payment that reverses the chargeback)  
8. **Comma-separated IDs** in at least one ID field (ex: `A,B,C`)  
9. **Multi-vendor** deposit file that includes at least one “Total” row you expect the parser to skip

---

# **UAT Flow (Plain-language runbook)**

## **Flow 1 — Upload deposit \+ map fields (covers P0 deposit upload items)**

### **1.1 Upload a deposit file**

1. Go to Deposit Upload.  
2. Upload a CSV/XLSX deposit file.  
   * (If PDF upload is implemented) upload a machine-readable PDF as a separate test.

**Expected**

* System detects Distributor/Vendor template and proposes mappings; you can edit and save mapping templates.

### **1.2 Verify mapping UI improvements (P0)**

On the field mapping screen:

1. Confirm there is a **Suggested Match** indicator/column.  
2. Try to map the **same system field twice** (intentionally).

**Expected**

* Suggested matches are visible.  
* The system blocks duplicate system-field mapping with a clear inline error.  
* The table is tall enough to use the full screen comfortably.

### **1.3 Verify “Review” step is merged (P0)**

**Expected**

* You should not be forced into a separate, redundant “Review” step; review happens in the mapping page flow.

---

## **Flow 2 — Multi-vendor upload (P0)**

Run this flow only if you have a multi-vendor combined report.

1. Upload the multi-vendor deposit report.  
2. Turn on **Multi-vendor** option.  
3. Confirm the file includes at least one “Totals” row.

**Expected**

* Non-transaction rows (like Totals) are skipped.  
* Each transactional row is assigned to the correct Vendor (and Distributor→Vendor is set).  
* Deposits/lines are created without you splitting files manually.

---

## **Flow 3 — Deposit detail verification fields (P0) \+ “no auto-select first line” (P1)**

1. Open the Deposit you just created.  
2. In the deposit header area, find:  
   * **Payment Received Date**  
   * **Actual Confirmed Deposit Amount**  
   * **Received By**  
3. Confirm “Date” is relabeled to **Report Date**.

**Expected**

* Those three verification fields exist and the labels match.  
* “Received By” is restricted to a controlled list (Admin-only dropdown was discussed). (ASSUMED: exact permissioning may still be evolving.)  
4. Navigate into the deposit line items list and/or reconciliation screen.

**Expected**

* The system does **not** auto-select the first deposit line item by default.

---

## **Flow 4 — Reconciliation workbench basics (covers multiple P0s)**

### **4.1 Confirm default view \+ basic filters**

1. Open the reconciliation page for the deposit.  
2. Look at the landing tab/view.

**Expected**

* Default view is **Unmatched** and there is no separate “Suggested” tab (if removed/hidden).

### **4.2 Multi-select (P0)**

1. Select multiple deposit lines using multi-select.  
2. Observe available actions.

**Expected**

* Multi-select works.  
* Bulk actions (Match, Split, etc.) only appear when selections are valid.

### **4.3 Bottom grid responds to top filters (P0)**

1. Apply a top-level filter (example: status=Unmatched, Vendor filter, etc.).  
2. Watch the bottom grid (revenue schedules).

**Expected**

* Bottom grid updates dynamically based on top filters.  
* No stale results after changing filters.

### **4.4 Matching uses Account Legal Name \+ IDs (P0)**

Use a deposit line that has Account Legal Name and/or Order/Customer/House IDs.

**Expected**

* Suggested matches appear and matching succeeds.  
* Those fields are actually used in candidate retrieval/scoring (not ignored).

### **4.5 Commission rate display/calc (P0)**

1. Open a suggested match.  
2. Confirm displayed commission rate matches what should be used for that match.

**Expected**

* Commission rate displayed matches the “source of truth” and saved values (no mismatch).

---

## **Flow 5 — FLEX creation (unmatched \+ overage) and FLEX resolution (P0)**

### **5.1 FLEX creation when no match exists**

Pick a deposit line you intentionally designed to produce **no match**.

**Expected**

* The system creates a FLEX schedule instead of leaving it untracked.  
* Milestone 3 explicitly calls out “Below 70% \= No match (create FLEX schedule)”.

### **5.2 FLEX type labeling (UNCERTAIN — capture what the UI does)**

Milestone 3 describes FLEX types like:

* FLEX‑O (Overage)  
* FLEX‑U (Underpayment)  
* FLEX‑B (Bonus)  
* FLEX‑CB (Chargeback)

Separately, the reconciliation workflow spec uses tag conventions like:

* “-F” for Flex schedules (overpayments)  
* “-CB” / “-CB-REV” for chargebacks/reversals

**UAT instruction**

* Record exactly what you see:  
  * Is it showing FLEX‑O/FLEX‑U/etc?  
  * Or is it showing “-F” tags?  
  * Or both?

### **5.3 FLEX schedule default date (UNCERTAIN — specs disagree; capture behavior)**

* One spec says Flex default date is **1st of current month** (editable pre‑reconciliation).  
* Milestone 3 text suggests a schedule date like **previous month’s 1st**.

**UAT instruction**

* Create a Flex schedule and record what date it defaults to.

### **5.4 FLEX resolution (P0)**

**Where to click (navigation callout)**

* In Reconciliation, select the Flex-created row (often tagged like `-F` / `FLEX-*`).  
* Look for a right-side details panel/drawer (sometimes opened by clicking the row).  
* In that details view, look for an action labeled **Resolve**, **Resolve Flex**, or **Resolve Exception** (often in an actions bar or `...` menu).  
* If you cannot find any Resolve entry point anywhere in the UI, log it as a **P0 blocker** (Flex resolution workflow is not reachable).

This is the big high-priority flow:

1. Open a Flex item that was created.  
2. Click into “Resolve” (or equivalent).

**Expected**

* User must choose whether this Flex maps to a **one-time** or **recurring** product.  
* If recurring is chosen, the system can create **additional schedules** based on user input.  
* If you rename/change product, the system prompts for **family** and **subtype** (so filtering works).

If the resolution UI is missing or incomplete, log as a **P0 failure** against the Flex resolution ticket.

---

## **Flow 6 — Underpaid → collections workflow (P1)**

1. Use a deposit line that makes a schedule **Underpaid** (partial payment).  
2. Mark/confirm the schedule is Underpaid.

**Expected**

* Underpaid status exists.  
* You can initiate a “Collections” workflow from that state (even if it’s a minimal first version).

(If collections isn’t implemented yet, record that it’s a gap and whether Underpaid is still tracked correctly.)

---

## **Flow 7 — Chargeback workflow (P0): “In Dispute” \+ manager approval \+ CB‑REV**

### **7.1 Create/ingest a negative deposit line**

1. Upload or create a deposit line with a **negative amount**.  
2. Go into reconciliation.

**Expected**

* A Chargeback schedule is created (tag “-CB”).

### **7.2 Status label must be “In Dispute” (not “Pending”)**

**Expected**

* Chargebacks are labeled “In Dispute” while awaiting review/approval; Jan 22 notes explicitly say the app was labeling them “pending” and needs to change to “in dispute”.

### **7.3 Manager approval**

**Where to click (navigation callout)**

* Start from the left nav and look for **Approvals**, **Reviews**, **Queue**, or **Chargebacks**.  
* If there is no dedicated queue, use filters/search in Reconciliation/Schedules to find `-CB` items with status **In Dispute**, then open the schedule details panel.  
* In the schedule/details view, look for **Approve** / **Reject** actions (often in an actions bar or `...` menu).  
* If a Manager can see the chargeback but cannot take an action anywhere in the UI, log it as a **P0 blocker** (approval workflow not navigable).

1. Log in as a Manager.  
2. Find the chargeback awaiting review.  
3. Attempt:  
   * Approve chargeback  
   * Reject chargeback

**Expected**

* Manager can approve/reject chargebacks.  
* Items are clearly flagged for review.

Note: The Jan 22 meeting explicitly states manager approval is “set up” but there wasn’t a way to manage it yet. If you still can’t approve/reject, that’s expected to fail today and should be logged as a P0 gap.

### **7.4 Chargeback reversal (CB‑REV)**

1. Add a later deposit line that reverses the chargeback.  
2. Reconcile it.

**Expected**

* A reversal schedule “-CB-REV” is created and both CB \+ CB‑REV appear for audit/history.

---

## **Flow 8 — Match-type wizard for 1:M / M:1 / M:M (P0)**

1. Select multiple deposit lines and try to match them to:  
   * one schedule (M:1), or  
   * multiple schedules (M:M), etc.  
2. Click “Match”.

**Expected**

* System detects match type (1:1 vs non‑1:1).  
* For non‑1:1, it launches the appropriate wizard with a progress indicator.  
* Wizard blocks invalid submissions and tells you what’s missing.

**ASSUMED**

* The exact wizard steps for bundle/split are still being finalized (ticket notes say the workflow spec depends on details being provided). So for UAT: validate the detection \+ guardrails exist even if the “perfect” wizard flow is still iterating.

---

## **Flow 9 — Undo/unmatch \+ comma-separated IDs (P1 \+ spec requirement)**

### **9.1 Comma-separated IDs parsing \+ admin edit (P1)**

1. Find an ID field that supports lists (Order ID, Customer ID, House ID, etc).  
2. Enter `A,B,C` (and try `A, B, C` too).

**Expected**

* System parses and stores consistently (trims spaces).  
* Admin can edit the list.

### **9.2 Undo/unmatch restores original metadata (P1 \+ spec)**

**Where to click (navigation callout)**

* In Reconciliation, after matching, select the matched line(s) and look for an **Undo**, **Unmatch**, or **Revert Match** action in the bulk actions bar.  
* If bulk actions are not available, open the matched row's details panel and look for the same actions under a `...` menu.  
* For audit/history, open the Deposit / Deposit Line Item / Revenue Schedule details and look for **History**, **Audit**, **Activity**, or **Timeline** (and capture screenshots showing who/when/what).  
* If there is no audit/history view anywhere, log it as a gap and clarify how Accounting is expected to verify changes.

1. Perform a match that causes IDs/metadata to be appended/changed.  
2. “Undo” or “Unmatch”.

**Expected**

* Deposit line and Revenue Schedule return to their pre-match state.  
* Metadata updates are reversed.  
* Audit trail remains (who/when/what/reason).

---

## **Flow 10 — Frozen columns \+ aligned scrolling \+ column order (P1)**

This is specifically to test the “comparison view” usability.

1. In reconciliation, scroll horizontally in the top grid (Deposit Line Items).  
2. Confirm the bottom grid (Revenue Schedules) stays aligned when you scroll (single synced scrollbar).  
3. Verify the **alignment pairs** are side-by-side vertically (examples: Line Item ↔ Line Item, Product Name ↔ Product Name, Account Name ↔ Legal Name, Quantity ↔ Quantity, Price Each ↔ Price Each, Actual Usage ↔ Actual Usage, Actual Commission ↔ Actual Commission).  
4. Verify the **frozen zone** includes the key alignment columns (Select, Line Item, Product Name, Account Name/Legal Name).

**Expected**

* Frozen columns remain visible while scrolling.  
* Column alignment holds across top/bottom grids (no drift).

---

## **Flow 11 — Change Start Date / schedule propagation (P1)**

This matters for vendors who pay “in arrears” (example discussed: payment received in Feb might be for Dec usage).

1. Go to a single product’s Revenue Schedules tab.  
2. Open the “Change Start Date” tab (or equivalent).  
3. Change the start date and include a reason.

**Expected**

* Reason is required.  
* You can see and confirm effects on future schedules (propagation behavior).

Also confirm whether the UI supports the propagation model described in the reconciliation workflow spec (“this only” vs “this \+ future”).

---

## **Flow 12 — End-to-end finalize and “Deposit \= Reconciled” condition**

**Where to click (navigation callout)**

* From the Deposit detail page, look for a primary action like **Finalize**, **Submit**, **Close Deposit**, or **Mark Reconciled** (often top-right).  
* If reconciliation is a separate screen, look for the finalize action in that screen's header actions.  
* If there is no finalize action anywhere, clarify whether the system auto-reconciles when allocation hits 100% (and what user action, if any, triggers status change).

1. Continue reconciling until:  
* all lines are allocated and/or properly handled (including Flex/Chargebacks).  
2. Submit/finalize the batch.

**Expected**

* Deposit flips to **Reconciled** when all lines are allocated (including Flex/CB where applicable).

---

# **Quick “must-pass” UAT checklist (what to log as defects if failing)**

### **P0 must-pass (blockers)**

* Multi-vendor upload: skips Totals, assigns vendor per row  
* Deposit verification fields \+ Report Date label  
* Reconciliation multi-select  
* Bottom grid responds to top filters  
* Commission rate display/calc correct  
* Matching uses Account Legal Name \+ Order/Customer/House IDs  
* Match-type wizard triggers for non‑1:1 cases  
* Chargebacks: “In Dispute” \+ manager approval path exists

### **P1 high priority**

* Frozen columns \+ synced scroll alignment  
* Flex resolution UI (one-time vs recurring; create additional schedules; prompt family/subtype)  
* Comma-separated IDs \+ unmatch reverses metadata updates  
* Collections workflow from Underpaid status (may be minimal v1)

---

# **Known uncertainties you should capture during UAT (don’t “guess”)**

1. **Flex naming \+ tagging**: FLEX‑O/U/B vs “-F” tagging (specs differ).  
2. **Flex default date**: previous month’s 1st vs current month’s 1st (specs differ).  
3. **Status model consistency** (“Billing Status field across entities” is explicitly a P0 item, but enumerations are not fully spelled out in the ticket log). During UAT, record what each module calls the same situation (Unreconciled/Open, Reconciled, Underpaid, Overpaid, In Dispute, Closed, etc.) so you can normalize it later.

---

## **If you want, I can also output this as a “UAT script” format**

Same content, but broken into:

* **Test Case ID**  
* **Preconditions**  
* **Steps**  
* **Expected result**  
* **Pass/Fail \+ notes fields**

(That tends to be easier to paste into a tracker / spreadsheet.)

---

## Flow 13 — Comma-separated IDs and aliases (CRM-MATCH-003)

Use the dedicated checklist for detailed steps: `docs/plans/CRM-MATCH-003-UAT.md`.

Minimum must-pass checks:

1. **Admin edit + round-trip formatting**
   - Enter `A1, a1` and `A2` (newline) in an Opportunity “Other IDs” field.
   - Expected: de-duped, stored canonically, and shown as a comma-separated list.
2. **Matching overlap**
   - Expected: case-insensitive overlap across any token counts as an exact ID match.
3. **Auto-fill (no overwrite)**
   - Expected: apply match fills missing Opportunity/Product alias fields only when empty.
4. **Undo**
   - Expected: admin can undo the tagged auto-fill audit entry and fields revert safely (conflicts block undo).
