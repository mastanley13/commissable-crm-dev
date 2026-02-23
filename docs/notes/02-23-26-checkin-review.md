According to documents from **February 2, February 5, February 17, and February 19, 2026**, here’s the **de‑duplicated action-item list** of what **Hunter / StrategixAI** needs to deliver for **Rob / Commissable**, organized in an implementation-ready way.

## Now

### Reconciliation and deposit UX fixes

* [ ] **Implement a “Deposit Summary” floating bar** on reconciliation/deposit pages (includes vendor dropdown + unallocated lines + usage + commissions).
* [ ] **Fix the Back button** behavior on reconciliation/deposit pages (navigation should reliably return to the expected prior page).
* [ ] **Transactions tab labeling cleanup:** rename/label “Payment Type” correctly and set “Type” to “Usage” (instead of “billing”).
* [ ] **Fix revenue schedule date generation** so schedules are created on **1st of month @ ~8am ET** and don’t drift due to DST/timezone behavior.

### Test environment cleanup for reliable UAT

* [ ] **Clear deposits + deposit line items in the test environment** so Rob can restart clean reconciliation testing (1-to-1, 2-to-1, etc.).
* [ ] **Clean up test data** (remove duplicate Edge/Sean Wallace, add Edge address, set DWReality overage values).

### Revenue schedules and inline editing usability (unblock Rob testing)

* [ ] **Revenue Schedule UI corrections:** rename “Payment Type” → **“Revenue Type”**, require **House Rep**, default **Sub-agent** to “None/NA”, and adjust field placement/layout per discussion.
* [ ] **Inline-edit popup improvements** for revenue schedules:

  * Default effective date to the **earliest schedule date**
  * Show **Old value vs New value**
  * Add a clearer **notification/confirmation** flow

### Flex and chargeback workflow UI tightening

* [ ] **Update Flex/Chargebacks UI**: label fields as expected/actual/delta, add a “related schedule” reference, green highlighting, and clear out old/confusing data.

### Critical workflow blockers found Feb 17

* [ ] **Fix “Mass Change Start Date” bug** (example: setting to Feb 1 incorrectly becomes June 1).
* [ ] **Fix Flex product workflow being inaccessible** (likely caused by the UI date filter excluding schedules starting in the past).

## Next

### One-to-many matching and schedule generation rules

* [ ] **Update 1-to-many matching behavior**:

  * Remove “Keep old schedules” option
  * Bundling replaces old schedules from a specified date
  * Block bundling when the commission rates differ and show a clear error message
  * Create *new individual schedules* per deposit line item for future 1-to-1 matching flows

### Status/history reliability for auditability

* [ ] Add **Deactivated** + **Deleted** statuses to the revenue schedule object.
* [ ] Fix **history logs not appearing on the parent Opportunity** record (when changes occur under revenue schedules).

### Collections/reporting adjustments

* [ ] Remove the **“Collections Check Down”** button and replace with a **Collections report/list** of schedules where “past due balance > $0,” linking into detail view.

  * **ASSUMED:** “Past due” means schedule date < “today” and remaining balance > 0; the Feb 17 notes don’t define the exact logic, so Rob needs to confirm.

### Terminology + UI polish

* [ ] Rename terminology in UI: **Usage Difference → Usage Balance Due** and **Commission Difference → Commission Balance Due**.
* [ ] UI improvements discussed: highlight key target fields on RS detail view during matching; freeze left-hand columns for easier comparisons in the schedule table.

### Undo/reversal safety

* [ ] Build **admin-only “Delete Deposit” macro** that automatically *unmatches all lines* before the deposit is deleted.
* [ ] Use AI to **map downstream effects** of key actions (delete account, delete opportunity, etc.) so undo/reversal logic is consistent and complete.

## Next

### Data migration enablement (Feb 19)

* [ ] Build **self-uploaders** in Settings for **Accounts / Contacts / Opportunities** (manual import capability).
* [ ] Produce a **migration order + handling plan** for Accounts, Contacts, Opportunities, Products, and Schedules (what gets loaded first, how to handle partial data).
* [ ] Implement **duplicate checks** before creating new Opportunities/Products/Revenue Schedules (guardrails to prevent accidental dupes).

  * **ASSUMED:** This needs explicit “match keys” (e.g., external IDs vs name+vendor+dates); Feb 19 notes call out the need, but don’t specify rules.
* [ ] Draft **data-derivation guidance** for missing fields (what can be inferred / derived if data isn’t present).

## Next

### CloudBot / AI deliverables (Feb 5 + Feb 19)

* [ ] **CloudBot scoping document** (security, deployment, capabilities) — explicitly called out as required before Rob proceeds.
* [ ] **Email Rob a CloudBot one-pager** covering: scope/security/deployment, DR/failover, access controls, updates, reuse, retainer framing.
* [ ] Plan to run a deeper **security audit after the reconciliation checkpoint** (agents + review).

## Dependencies and clarifications needed from Rob/Commissable

These aren’t “Hunter/StrategixAI tasks,” but they **block** some of the above:

* **Confirm final UX behavior** for the deposit summary widget (bar vs draggable widget behavior, hide/unhide expectations).
* **Confirm “past due” definition** for the new collections report/list (date basis + which balance field).
* **Confirm duplicate detection rules** for migration (what fields constitute a duplicate for opp/product/schedule) since the need is stated but the criteria is not.
