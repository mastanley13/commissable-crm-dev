# Commissable CRM – Master Task List (Changes / Updates / Fixes Only)

Legend:
- `[ ]` = TODO
- `[x]` = DONE
- (You can also use `[ ] Status: IN PROGRESS` to mark WIP items)

---

## 0. Global Plan of Approach

1. Finish **Reconciliation core** (UI + matching + deposit workflow) so Rob can run realistic tests end‑to‑end.
2. Hardening around **Revenue Schedules** (copy/clone, delete gating, detail layout, tickets, reassignment tests).
3. Fix **Deposit upload** UX and data shape to support clean reconciliation.
4. Tighten **Admin / Settings / Permissions** so new features are properly controlled.
5. Clean up **Product catalog & Add Product** UI.
6. General **UI polish** (Accounts labels, commission column spacing, summary lines, etc.).

---

## 1. Reconciliation Experience

### Phase: NOW – Core UI & Behavior

- [ ] **REC-01 – Implement Reconciliation UI core actions (per 12‑02 action item)**  
  **Status:** IN PROGRESS  
  **Progress:** Hierarchical matcher forced on; future-dated toggle user-facing; line/schedule tables sortable with consistent arrows; schedule-side “Matched” state shown and default Product→Date sort applied. Finalize/Unfinalize flows now recompute schedules; delete deposit endpoint wired with rollback; remaining: highlights/variance cues and final polish (sticky headers, totals/back control).  
  **Description:**  
  Implement the main reconciliation workspace so a user can reconcile a deposit end‑to‑end:  
  - Proper **currency formatting** for all revenue/commission fields (dollars, 2 decimals).  
  - Proper **date formatting** for period fields (use business‑friendly date or `YYYY‑MM` where specified).  
  - Working controls for:
    - **Match / Unmatch** schedule(s) to deposit line items.
    - **Reconcile** (finalize matched items and mark deposit/schedules as reconciled/closed).
    - **Delete deposit** (with appropriate confirmation and status handling).
  - **Filters** for:
    - Suggested / All / Matched / Unmatched / Reconciled for schedules and (ASSUMED) deposit line items.
    - Status filters (e.g., open / partially paid / reconciled).  
  - **Sorting** on key columns (date, account, amount, confidence, etc.).  
  - Visual **highlights** for:
    - High/medium/low confidence suggestions.
    - Variance over tolerance.  
  - Add an **AI trigger** (button or menu action) to request AI‑generated suggested matches for current deposit.  
  **Dependencies:**  
  - Matching logic spec (Primary Matching Hierarchy & Two‑Pass system).  
  - Existing POC classes (`ReconciliationUI`, `BulkOperationsManager`) to be wired in.  
  **ASSUMED:**  
  - AI trigger will call a backend service that wraps the matching engine and returns suggested matches plus confidence.

- [ ] **REC-02 – Apply matching logic per “Matching Logic Notes”**  
  **Status:** IN PROGRESS  
  **Progress:** Hierarchical Pass A/B is now default (no legacy toggle), confidence scores active, distributor/vendor gates + FIFO + status filters live. Future-dated toggle exposed to users. Still pending: ingestion of Location/PO/Product Description fields and any remaining production rollout tuning.  
  **Description:**  
  Ensure the reconciliation engine actually implements the documented rules:  
  - **Primary matching hierarchy** with Distributor & Vendor as hard prerequisites, then Account Legal Name, IDs, PO/Location, product/part, description, and date, in that order.  
  - **Two‑pass system**:
    - Pass A: exact match on strong identifiers with 100% confidence; auto‑apply within tolerance.  
    - Pass B: fuzzy match with weighted similarity (Account name ~40%, Product name ~30%, Amount ~20%, Date ~10%).  
  - **Tie‑breakers & filters**:
    - FIFO by schedule date when multiple candidates for a product.  
    - Date filter: default to current month or earlier; future schedules only if user enables “Include future‑dated”.  
    - Status filter: only OPEN / PARTIALLY_PAID with positive commission differences.  
  **Dependencies:**  
  - Data model exposing all required fields on both deposit line items and revenue schedules.  
  **ASSUMED:**  
  - Confidence score thresholds (e.g., ≥90%, ≥75%) will match those used in the POC bulk‑operations design.

- [ ] **REC-03 – Reconciliation UI layout & usability polish (11‑24 + 12‑02)**  
  **Status:** IN PROGRESS  
  **Progress:** Core grid with currency/date formatting; default Product→Date sort for schedules and sortable headers on both grids are in place; future-dated toggle placed with status filter. Still to do: sticky headers/spacing polish, finalize status label alignment, and top-level totals/back navigation polish.  
  **Description:**  
  Apply all layout / UX tweaks called out for the reconciliation screen:  
  - **Tighten row height** and column spacing to reduce vertical scrolling.  
  - Clean up **column headers** (shorter labels, consistent alignment, avoid wrapping where possible).  
  - **Float scrollbars / sticky headers** so column headers remain visible while scrolling.  
  - Add a clear **“Back”** control from reconciliation back to deposit list.  
  - Add top‑level **totals** for the selected deposit:
    - Total deposit amount.
    - Amount matched so far.
    - Remaining unmatched amount.  
  - Ensure **Period**/date fields display as `YYYY‑MM` (or whatever final pattern Rob chose).  
  **Dependencies:**  
  - Core reconciliation grid already rendering.  
  **ASSUMED:**  
  - We follow POC styling where possible (hover states, confidence badges).

### Phase: NEXT – AI & Bulk Operations

- [ ] **REC-04 – Wire AI auto‑match & bulk actions (from POC)**  
  **Status:** IN PROGRESS (per 2025-12-04 reconciliation snapshot)  
  **Progress:** “Run AI Matching” button and Pass A auto-match flow exist with variance tolerance; confidence stored for auto matches. Pass B auto-apply, bulk actions (medium confidence, FLEX creation, exception export), and UI surfacing of results are still pending.  
  **Description:**  
  - Hook the UI’s AI trigger into an **auto‑apply engine** that:
    - Generates candidate matches with confidence scores.
    - Applies matches automatically at user‑selected thresholds (e.g., ≥90% or ≥75%).  
  - Implement bulk actions from the POC:
    - Auto‑match high confidence.
    - Auto‑match medium confidence.
    - Create **Flex products** for unmatched line items (ASSUMED: optional but in design).
    - Export **exception report** for unresolved/over‑variance items.  
  - Display bulk operation results (processed, successful, failed, exceptions).  
  **Dependencies:**  
  - REC‑02 matching logic implemented.  
  - Back‑end bulk matching service or equivalent in the app.  
  **ASSUMED:**  
  - We persist auto‑match decisions and expose them to the user in reconciliation history.

---

## 2. Deposits & Deposit Upload

### Phase: NOW – Support Reconciliation

- [ ] **DEP-01 – Update deposit upload form (11‑24 action item)**  
  **Status:** TODO  
  **Progress:** Not started in current snapshot; form still needs redesign to remove manual name/customer/created-by and add commission period.  
  **Description:**  
  Redesign the deposit upload wizard to match Rob’s flow:  
  - Remove the **manual deposit name** field; auto‑generate deposit name as:  
    `YYYY-MM-<DistributorName>-<VendorName>` (or without vendor if not applicable).  
  - Remove **Customer** field (not needed here).  
  - Remove **Created By** selector; default to the authenticated user.  
  - Add **Commission Period** field (month/year) required for reconciliation.  
  - Shrink & align fields so **date, distributor, vendor** can sit on a single row (where screen width allows).  
  - Remove template‑specific helper text like “select created by distributor vendor to create a template”.  
  **Dependencies:**  
  - Distributor & Vendor dropdowns populated and searchable (type‑ahead).  
  **ASSUMED:**  
  - Template behavior (if any) is handled by a separate control, not the base upload form.

- [ ] **DEP-02 – Add sample deposit line items for testing (12‑02 action item)**  
  **Status:** TODO  
  **Progress:** No evidence of a seeded test dataset yet; needs sample deposits across distributors/vendors and edge cases.  
  **Description:**  
  - Ensure there is a robust sample dataset of **deposit line items** in the dev/staging environment for StrategixAI to test:
    - Multiple distributors/vendors.
    - Edge cases (partial matches, variance, missing product names, etc.).  
  **Dependencies:**  
  - Data import tooling or seed script.  
  **ASSUMED:**  
  - This is a one‑time or occasionally updated test dataset, not a permanent feature.

### Phase: NEXT – Deposit Summary UX

- [ ] **DEP-03 – Improve deposit summary view (11‑24 notes)**  
  **Status:** TODO  
  **Progress:** Not started; summary grid still needs totals (allocated/unallocated) and clearer status ordering.  
  **Description:**  
  - Ensure deposit “list” / summary grid includes:
    - Total deposit amount.
    - Amount allocated (matched).
    - Unallocated/unmatched amount.
    - Deposit status (open / in progress / ready to reconcile / reconciled).  
  - Column order should support quickly seeing **which deposits still need work**.  
  **Dependencies:**  
  - REC‑01 (matching & reconcile actions) so these totals and statuses are meaningful.

---

## 3. Revenue Schedules

### Phase: NOW – Copy / Clone / Delete

- [ ] **RS-01 – Update revenue schedule copy/create flow (11‑24 action item)**  
  **Status:** TODO  
  **Progress:** Not started; copy/create flow still needs auto-numbering, start date labeling, and multi-schedule generation.  
  **Description:**  
  When copying or generating schedules from a product/opportunity:  
  - Auto‑number new schedules with a consistent naming convention (ASSUMED: `<BaseName> - Period X of Y`).  
  - Label the date field clearly as **“Start date”** (and show period/term separately if needed).  
  - Add **“Number of schedules”** field to let the user generate multiple future periods at once.  
  - Pre‑fill fields (amount, quantity, etc.) from the source schedule when copying.  
  - **Hide the adjustment field** during initial creation/copy (adjustments should be applied later to fix discrepancies).  
  **Dependencies:**  
  - Existing revenue schedule create/edit endpoints.

- [ ] **RS-02 – Implement Clone Revenue Schedule modal (12‑02 action item)**  
  **Status:** TODO  
  **Progress:** Not started; standard-size modal with prepopulated numeric fields still pending.  
  **Description:**  
  New modal for cloning a single schedule:  
  - Modal should use the **standard size** (avoid overly large custom sizing).  
  - Prepopulate editable fields from the source schedule:
    - Quantity.
    - Price per unit.
    - Commission rate / expected commission.  
  - Show the **new schedule name** read‑only (auto‑generated).  
  - Let the user edit prepopulated numeric fields before saving, including an optional **adjustment field** for rare surcharge cases.  
  **Dependencies:**  
  - RS‑01 naming rules, so clone and multi‑create behave consistently.

- [ ] **RS-03 – Implement revenue schedule delete gating (11‑24 action item)**  
  **Status:** TODO  
  **Progress:** Not started; role-based restrictions and reconciled-state protections not yet wired.  
  **Description:**  
  - Restrict **delete** of revenue schedules to specific roles:
    - Admin.
    - Accounting (or equivalent finance role).  
  - Prevent deletion by standard users; show appropriate error / disabled state.  
  - Ensure deletion rules respect reconciliation state (ASSUMED: cannot delete if already reconciled).  
  **Dependencies:**  
  - ADM‑03 (permissions model updated for new features).  
  **ASSUMED:**  
  - Hard rules: once reconciled, schedules are immutable except via adjustment mechanism.

### Phase: NOW – Detail Layout & Tickets

- [ ] **RS-04 – Revise Revenue Schedule Detail layout to 3 columns (12‑02 action item)**  
  **Status:** TODO  
  **Progress:** Not started; detail view still needs 3-column layout and responsive stacking.  
  **Description:**  
  - Update revenue schedule detail view to use a **3‑column** layout to maximize information density:
    - Group related fields logically in each column (account/product, schedule details, financials, etc.).  
  - Ensure responsive behavior on smaller screens (ASSUMED: stack columns).  
  **Dependencies:**  
  - Existing detail view must be refactored; may share layout components with other objects.

- [ ] **RS-05 – Add Tickets tab to Revenue Schedule Detail (12‑02 action item)**  
  **Status:** TODO  
  **Progress:** Not started; tickets table and linkage to revenue schedules still to be implemented.  
  **Description:**  
  - Add a **“Tickets”** tab alongside Activities/Notes on Revenue Schedule Detail:  
    - Table columns: Ticket number, Date, Owner, Subject/Description, Status, (optional) Days open.  
    - Behavior similar to Activities/Notes tab (filtering, sorting, basic pagination).  
  - Tickets should be linked to the specific revenue schedule.  
  **Dependencies:**  
  - Ticket data model and API (ASSUMED already exists or will be added).  
  **ASSUMED:**  
  - Only Revenue Schedules get this tickets tab (per Rob’s comment), not every object.

### Phase: NEXT – Reassignment & Testing

- [ ] **RS-06 – Test revenue schedule reassignment edge cases (12‑02 action item)**  
  **Status:** TODO  
  **Progress:** Not started; edge-case testing for period start/end behaviors still required.  
  **Description:**  
  - Thoroughly test revenue schedule reassignment behavior for:
    - Schedules whose period is the **1st of the month**.
    - Schedules whose period is already **over** (past end date).  
  - Confirm expected behavior for commissions, owner, and any audit trail entries.  
  **Dependencies:**  
  - ADM‑01 (Reassignment UI) and underlying reassignment logic must be complete.  
  **ASSUMED:**  
  - Reassignment may affect reporting and reconciliation; verify there are no orphaned records.

---

## 4. Product Catalog & Add Product

### Phase: NEXT – Core Product Entry

- [ ] **CAT-01 – Implement Add Product popup redesign (Master Action Item Log)**  
  **Status:** TODO  
  **Progress:** Not started; 2-column lookup/details layout still pending.  
  **Description:**  
  Replace the existing Add Product popup with the approved 2‑column design:  
  - **Left column:** product lookup flow  
    - Distributor → Vendor → Product Family → Product Name (numbered top‑to‑bottom).  
    - Type‑ahead dropdowns where appropriate.  
    - “Add New Product” button if no match is found.  
  - **Right column:** product details  
    - Quantity, Price, Expected Commission, Number of periods, Start date, etc.  
  - **Hide Opportunity ID** field from the popup (handled via context instead).  
  - Fix date picker & calendar alignment.  
  **Dependencies:**  
  - Product catalog data model and distributor/vendor relationships.

- [ ] **CAT-02 – Tidy product catalog “Create New Product” layout (11‑24 action item)**  
  **Status:** TODO  
  **Progress:** Not started; label/input alignment and currency/percent formatting still needed.  
  **Description:**  
  - Fix label/field alignment so the input is **visually aligned with its label** (no confusing gaps).  
  - Improve spacing to avoid user mis‑entering data into the wrong line.  
  - Auto‑format **price** and **commission** fields as currency/percent as appropriate.  
  - Remove the **“House Description”** line if not needed.  
  **Dependencies:**  
  - Shared form components used across catalog and other modules.

---

## 5. Admin, Settings & Reassignment

### Phase: NEXT – Reassignment UX

- [ ] **ADM-01 – Update reassignment modal (11‑24 action item)**  
  **Status:** TODO  
  **Progress:** Not started; modal still needs radio choice, default selection, counts, and resize.  
  **Description:**  
  Improve the reassignment modal for accounts/contacts/opportunities:  
  - Use a **radio button** choice where only one option is valid (e.g., “New owner” vs alternative).  
  - Default selection to **new owner** when appropriate.  
  - Remove redundant middle column/section that’s no longer needed.  
  - Resize the modal to a more compact, readable size.  
  - Add **counts** (number of accounts/contacts/opportunities) impacted by the reassignment.  
  - Remove the extra **“Reassign” column** if it duplicates the main action.  
  **Dependencies:**  
  - Existing reassignment workflow and data model.  
  **ASSUMED:**  
  - Reassignment is used by managers/admins; permissions must be enforced (see ADM‑03).

- [ ] **ADM-02 – Decide & document global undo approach (11‑24 action item)**  
  **Status:** TODO  
  **Progress:** Not started; decision between inline undo vs audit-log reversal still pending.  
  **Description:**  
  - Decide whether “undo” should be:
    - A **post‑action inline undo** (brief “undo” link after an action),  
    - Or exclusively handled by a **History/Audit log** where actions can be reversed via explicit operations.  
  - Document the decision and communicate to StrategixAI so UI and backend are designed accordingly.  
  **Dependencies:**  
  - Understanding of which operations must be reversible (reassignment, delete, reconcile, etc.).  
  **ASSUMED:**  
  - For reconciliation and financial actions, audit‑log‑based reversal is safer than inline “undo”.

### Phase: NOW → NEXT – Admin & Permissions

- [ ] **ADM-03 – Update Admin/Settings permissions for new features (12‑02 action item)**  
  **Status:** TODO  
  **Progress:** Not started; reconciliation, deposit upload, revenue schedule delete, reassignment, and tickets permissions not yet exposed.  
  **Description:**  
  - Extend the permissions model so newly added features are covered:  
    - Reconciliation workspace (view vs execute).  
    - Deposit upload.  
    - Revenue schedule delete.  
    - Reassignment tools.  
    - Tickets tab on revenue schedules.  
  - Update Settings/Admin UI so:
    - Admins can configure which roles can access each feature.  
    - Account Owner dropdowns pull from the correct set of users.  
  **Dependencies:**  
  - Role/permission data model.  
  **ASSUMED:**  
  - Multi‑tenant SaaS scenario; permissions must be tenant‑scoped.

- [ ] **ADM-04 – Re-hook Account Owner dropdown to dynamic list (12‑02 action item)**  
  **Status:** TODO  
  **Progress:** Not started; owner dropdown still needs to reflect newly added eligible users automatically.  
  **Description:**  
  - Fix the Account Owner dropdown so:
    - Adding a new account owner in Admin/Settings automatically shows up in all relevant dropdowns.  
  - Ensure it filters to eligible users (ASSUMED: users with account‑owner‑eligible roles).  
  **Dependencies:**  
  - User table and role assignments; UI event to refresh owners list.

---

## 6. General UI / UX Polish

### Phase: NEXT – System‑Wide Polish

- [ ] **UI-01 – Fix Accounts page label alignment (Master Action Item Log)**  
  **Status:** TODO  
  **Progress:** Not started; label vertical alignment and field width tweaks still required.  
  **Description:**  
  - Align **field labels** to the middle on the Accounts page.  
  - Shorten top‑left fields so they align with the **date picker** row.  

- [ ] **UI-02 – Adjust commission summary column spacing (Master Action Item Log)**  
  **Status:** TODO  
  **Progress:** Not started; commission amount columns still need spacing/gap adjustments.  
  **Description:**  
  - Shift **commission amount columns** slightly to the right to avoid overlapping labels.  
  - Add a small gap between labels (e.g., “Commission Actual”) and their values for readability.  

- [ ] **UI-03 – Add bottom separator line to Revenue Schedules summary (Master Action Item Log)**  
  **Status:** TODO  
  **Progress:** Not started; separator line still missing.  
  **Description:**  
  - Add a subtle horizontal separator line at the bottom of the Revenue Schedules summary section to visually delimit it.

- [ ] **UI-04 – Global currency & date formatting sweep (extends reconciliation work)**  
  **Status:** IN PROGRESS (per 2025-12-04 reconciliation snapshot)  
  **Progress:** Reconciliation views now format currency consistently; broader app-wide sweep and period formatting alignment still pending.  
  **Description:**  
  - Ensure **all** revenue/commission/amount fields in the app use consistent currency formatting (dollars, 2 decimals).  
  - Ensure **all** period/date fields follow the chosen format (e.g., `YYYY‑MM` for periods, localized date for timestamps).  
  **Dependencies:**  
  - REC‑01 decisions for reconciliation formatting; replicate globally.

---

## 7. Data & External Dependencies

### Phase: NOW – Salesforce / Source System Prep

- [ ] **DATA-01 – Ensure Account Legal Name is available on Revenue Schedules (12‑02 action item)**  
  **Status:** TODO  
  **Progress:** Not started; Salesforce/export update still needed so matching can use Account Legal Name reliably.  
  **Description:**  
  - Confirm external system (e.g., Salesforce) has **Account Legal Name** copied down to revenue schedules (Rob’s India dev task).  
  - This is critical because matching hierarchy uses **Account Legal Name** as a strong field after Distributor/Vendor.  
  **Dependencies:**  
  - Coordination with Rob’s Salesforce developer.  
  **ASSUMED:**  
  - Import/mapping scripts into Commissable will be updated once the field exists in exports.

---

## 8. Product & Layout Specs (Owner: Rob / Design, but relevant for dev)

*(These are not UI code changes directly, but they gate or influence implementation. Keep them tracked so Cursor/you can confirm they’re done.)*

### Phase: NEXT

- [ ] **SPEC-01 – Final Add Product popup spec & mock (Master Action Item Log)**  
  **Status:** TODO  
  **Progress:** Awaiting design spec/mock from Rob for the 2-column popup.  
  **Description:**  
  - Rob to provide detailed spec + mock for new Add Product popup (2‑column design).  
  - Dev to confirm feasibility and update CAT‑01 implementation accordingly.  

- [ ] **SPEC-02 – Define split between opportunity‑specific vs global Revenue Schedule management (Master Action Item Log)**  
  **Status:** TODO  
  **Progress:** Awaiting decision/spec; navigation split not yet documented.  
  **Description:**  
  - Clarify which actions live on:
    - **Opportunity detail page** (single‑opportunity schedules).  
    - **Global Revenue Schedules tab** (mass updates, cross‑opportunity changes).  
  - Update UI + navigation to reflect the split.  

- [ ] **SPEC-03 – Propose layout for Payments Made & Financial Summary tabs (Master Action Item Log)**  
  **Status:** TODO  
  **Progress:** Awaiting proposed layout from Rob; implementation blocked on spec.  
  **Description:**  
  - Rob to propose new layout for **Payments Made** tab and **Financial Summary** area.  
  - Dev to implement once spec is received.

---

## Open Questions / ASSUMED Items for Later Clarification

- **Undo Design (ADM‑02)** – Needs a final call; impacts how we implement destructive or complex actions system‑wide.
- **AI Learning / Feedback Loop for Matching** – ASSUMED as future iteration once base matching and reconciliation are stable.
- **Pass‑Through Rate Feature** – Explicitly future scope; not included as a current task list item, but will require its own set of specs and DB changes later.
- **Flex Products & Exceptions Export (REC‑04)** – Present in the POC; may be deferred if core reconciliation slips schedule.

