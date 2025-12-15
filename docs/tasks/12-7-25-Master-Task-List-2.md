# Commissable CRM – Master Engineering Task List

*Source: Master Action Item Log (updated through 2025‑12‑06)* 

**Status legend (edit manually):**

* `[ ]` = Not started
* `[~]` = In progress
* `[x]` = Done

You can save this as `commissable_master_tasks.md` for your Cursor agent.

---

## PHASE NOW – Unblock Reconciliation & Stabilize Core Data

### A. Data Integrity & Core Constraints

* [X] **Enforce product creation constraints** – Require an **active Distributor** and **active Vendor** to create a product; block creation if either is inactive or wrong account type.
* [x] **Add “None‑Direct” Distributor account** – Create a special Distributor record for direct vendor purchases and wire it into product/opportunity product flows as the allowed “direct” path.
* [x] **Fix orphaned revenue schedules on product delete** – When an opportunity product is deleted **and no monies have ever been applied**, hard‑delete its related revenue schedules instead of leaving orphans.
* [x] **Gate revenue schedule deletion** – Prevent deletion of any revenue schedule that has **usage or commission applied**; allow only Admin/Accounting roles to delete eligible schedules. (ASSUMED: applies from both Opportunity and global Revenue Schedules modules.)
* [x] **Implement product deletion gating** – Disallow deletion of any product that has **any associated revenue schedules (past or future)**; such products can only be inactivated.
* [x] **Account-type filtering for Distributor/Vendor dropdowns** – Ensure all Distributor/Vendor dropdowns (Catalog, Opportunity Product popup, Revenue Schedule builder, Reconciliation) only show Accounts with the correct `Account Type`.

---

### B. Product Catalog & Product Creation (Global + Opportunity)

#### B1. Catalog main list & detail

* [ ] **Rename Products list to “Catalog” in navigation and UI**.
* [ ] **Standardize Product Detail & “Create New Product” layout** (Catalog):

  * Left column: Product Name – House, Part Number – House, Distributor Name, Vendor Name, Product Family – House, Product Subtype – House.
  * Right column: Price Each, Commission %, Revenue Type, Status.
  * Bottom: House – Description; Distributor/Vendor sections below.
* [ ] **Ensure Product Family and Product Subtype are editable by Admins** in the Catalog for corrections (not locked once created).
* [ ] **Enforce Product Revenue Type options** – Restrict Revenue Type field to the agreed list (NRC – Quantity / NRC – % / NRC – Flat Fee / MRC – 3rd Party / MRC – House / NRC – Resale) and fix any legacy mismatches.
* [ ] **Auto‑format product monetary and percent fields** – On blur, ensure `Price Each` formats as `$XX.XX` and `Commission %` as `XX.XX%` everywhere (Catalog + Opportunity).
* [ ] **Mass inactivation for products** – From the Catalog list, allow filtering + multi‑select → bulk “Make Inactive” and hide inactive items by default (only visible via status filter).
* [ ] **Mass commission rate adjustment within Catalog** – Add bulk “Adjust Commission Rates” workflow: filter → select multiple products from a vendor → edit commission % on one row → apply to all selected (with History log of old value/new value/user/timestamp).
* [ ] **Catalog filter: show products without revenue schedules** – Add a filter toggle to list only products with no revenue schedules created yet (to help clean up unused catalog entries).

#### B2. Opportunity Product tab – Add/Create Product flow

* [ ] **Replace “Add New” with “Add/Create Product” button** on Opportunity > Products tab.
* [ ] **Implement two‑mode Product popup** on Opportunities:

  * Mode 1 – **Add Product from Catalog**

    * Filter path: Distributor Name → Vendor Name → Product Family – House → Product Subtype – House → Product.
    * When a product is selected, prefill right‑side fields: Quantity=1, Price Each (from catalog), Expected Commission Rate % (default), Expected Commission Start Date (1st of current month), Number of Periods=1 – all editable before schedule creation.
  * Mode 2 – **Create New Product**

    * Use **the same field order & layout** as the Catalog “Create New Product” popup.
    * On save, create the product in the Catalog and add it as an opportunity product with initial schedules.
* [ ] **Fix broken dropdowns & tab order in Product popup** – Distributor/Vendor dropdowns must function and keyboard tabbing must follow logical top‑to‑bottom, left‑to‑right order.
* [ ] **Correct product selection flow in the existing popup** – Ensure the current flow actually respects: Distributor Name → Product Name → Product Family → Product Subtype → available products list (per Dec‑04 notes).
* [ ] **Build revenue schedule creation step after product selection** – Once the product is chosen:

  * Show Distributor/Vendor dropdowns (filtered by account type), Product Family and Product Subtype, then Quantity, Price Each, Revenue Schedule Start Date, Number of Periods, Expected Commission Rate %.
  * On save, generate a series of schedules according to start date + periods.
* [ ] **Fix Revenue Schedule Start Date behavior in Product popup** – Remove overlapping “filler” date text and default the date to the **first of the current month** when the field receives focus.
* [ ] **Hyperlink Product / Distributor / Vendor names** from the Opportunity Products tab to their respective detail pages.
* [ ] **Add Product Billing Status to Opportunity Products tab** as a dynamic column (and to Catalog list) and wire it into schedule auto‑creation logic (see Revenue Schedules section).

---

### C. Revenue Schedules – Lists, Tables & Cloning

#### C1. Revenue Schedule table (Opportunity & global module)

* [ ] **Fix Revenue Schedule table date format** – Standardize to `YYYY‑MM‑DD` everywhere, including Opportunity > Revenue Schedules tab and the global Revenue Schedules module. (ASSUMED: we adopt `YYYY‑MM‑DD` over earlier `MM‑DD‑YYYY` mention to match global spec.)
* [ ] **Add key columns to Revenue Schedule table** – Include Opportunity Name, Account Name, Distributor, Vendor in the table columns where they are missing.
* [ ] **Fix column sorting** – Enable A→Z / Z→A sorting on all sortable columns on the Opportunity Revenue Schedules tab and the global Revenue Schedules list.
* [ ] **Normalize column widths** – Narrow Select‑All, Status, Quantity columns and remove extra header whitespace.
* [ ] **Fix select‑all checkbox behavior** – Ensure the header checkbox can select **and unselect** all rows cleanly without desync.
* [ ] **Standardize money and percent formatting** – All monetary fields show `$XX.XX`; all percent fields show `XX.XX%` in tables and detail views.
* [ ] **Fix filter layout on global Revenue Schedules page** – Prevent filter row from wrapping and remove redundant “Show In Dispute Only” checkbox in favor of a consolidated Status dropdown (`All/Open/Reconciled/Unreconciled/In Dispute`).

#### C2. Bulk management & inline editing

* [ ] **Add “Manage” bulk action for Revenue Schedules (global)** – When one or more schedules are selected, show a Manage button that opens a consistent popup with:

  * Bulk Inactivate/Delete actions (respecting deletion gating rules).
  * Admin‑only bulk edits for Quantity, Price Per, Expected Commission Rate %, and Expected Usage Adjustment with “Apply to Selected”.
* [ ] **Bulk edit for Opportunity‑level Revenue Schedules** – Allow Admins to select multiple schedules for a product, specify an **effective date** and new rate, and update Expected Commission Rate % from that date forward without changing prior periods.
* [ ] **Ensure recalculation of dependent fields on save** – When price, quantity, rate, or splits change, recompute Expected Usage and commission splits (House, House Rep, Subagent) consistently. (ASSUMED global requirement per 2025‑11‑10 notes.)

#### C3. Cloning & extending schedules

* [ ] **Implement multi‑period “Copy/Extend” for revenue schedules** – Update the Copy/Clone modal to:

  * Show key context fields (Name, Usage Net, Rate).
  * Include a “Revenue Schedule Date” field and “Number of schedules to create” input.
  * Auto‑generate one schedule per month from the chosen start date for N periods.
  * Use a new auto‑incrementing numeric ID instead of “copy” suffix for names.
  * Exclude matched/reconciled schedules from being eligible as sources if that’s the agreed behavior.
* [ ] **Standardize Clone/Copy modal size and formatting** – Use the standard modal size, add calendar date picker, ensure date format and currency/percentage formatting are correct.

#### C4. Auto‑generation & lifecycle

* [ ] **Auto‑create next month’s schedule when Product Billing Status = Billing** – On the 1st of each month, automatically create a new schedule for each active billing product where the prior month’s schedules are exhausted.
* [ ] **Implement schedule inactivation** – Allow users to mark schedules Inactive when a product stops billing, without deleting historical records.
* [ ] **Wire “In Dispute” flag** – Add an “In Dispute” checkbox on revenue schedules and automatically set it when a Ticket is created from that schedule.

---

### D. Reconciliation – Deposit Upload & Core Matching UI

#### D1. Deposit list & upload

* [ ] **Redesign Deposits main page as focused admin workspace** – Remove charts/graphs, move them to the dashboard; restrict the page to Admins/Accountants.
* [ ] **Add period selector to Deposits page** – Month/year selector with previous/next buttons that updates the list and summary metrics for the selected period.
* [ ] **Show period metrics in header** – For the selected period, display: Total Usage, Total Commissions, Total Past Due Schedules, Total Past Due Amount.
* [ ] **Standardize deposit name auto‑generation** – On upload, auto‑name deposits as `YYYY‑MM‑DD_Distributor_Vendor`.
* [ ] **Add required “Commission Period” field on upload** – Use Commission Period to filter candidate schedules (e.g., October deposit for September commissions only matches September schedules).
* [ ] **Clean up deposit upload form UI** – Remove unused fields (Customer, Created By), shrink overly wide fields, remove template/help text that clutters the form, and ensure back navigation from deposit detail to Deposits list.

#### D2. Reconciliation workspace (per‑deposit)

* [ ] **Implement 2‑table reconciliation layout** for each deposit:

  * Top table: Deposit line items from uploaded report.
  * Bottom table: Suggested revenue schedules when a line item is selected.
* [ ] **Implement consolidated “Deposit Status” column on line items** – Replace row‑level match buttons with one status column: `Unmatched / Suggested / Matched / Reconciled`.
* [ ] **Add “Match Selected Items” button** – Single button enabled only when one deposit line and one revenue schedule (or allowed many‑to‑one/one‑to‑many combination) are selected; applies the match.
* [ ] **Inline editing for key schedule fields in reconciliation** – Allow editing Quantity, Price, Rate, Adjustment directly in the bottom table for speed, including recalculation of amounts on save.
* [ ] **Filtering controls on reconciliation** – Convert pill filters to dropdowns:

  * Deposit line items: `Unmatched / Partial / Matched / All`.
  * Revenue schedules: `Suggested / Unreconciled / Reconciled / All Schedules`.
* [ ] **Visual match highlights** – Highlight matching fields (e.g., Account, Product, Amount, Date) with subtle shading to explain why a schedule was suggested.
* [ ] **Implement Match/Unmatch/Reconcile/Unreconcile flows** –

  * Support unmatching a schedule from a line item.
  * Support unreconciling an entire deposit.
  * Allow deleting a deposit when appropriate (ASSUMED: only when no reconciled line items).
* [ ] **Add Undo control** – Next to matched/reconciled status, add an Undo button to reverse the last match/reconcile action for that line item/schedule.

---

### E. Data & Testing Support (Non‑UI but critical for plan)

* [ ] **Load mini dataset for smoke testing** – 2 vendors, 2 opportunities, representative products and schedules for core flows (Accounts → Opportunities → Products → Schedules → Deposit).
* [ ] **Add additional deposit line items for AI & reconciliation testing** – Ensure there is a realistic spread of line items (partial payments, over/under payments, multiple periods).
* [ ] **Verify schedule reassignment behavior across 1st‑of‑month boundaries** – Test that reassignment and commission rate changes correctly apply from the effective date forward without altering history.

---

## PHASE NEXT – AI Matching, History, Admin Tools & Advanced Workflows

### F. AI Matching & “AI Wizard” Page

* [ ] **Build “AI Wizard” manual review page** – Larger view listing: deposit line item, suggested schedule, confidence score, match reason chips (e.g., Order ID, Customer ID, Account Name), suggested adjustment amount.
* [ ] **Manual AI trigger from reconciliation UI** – Add a button to run AI matching for a deposit and populate the AI Wizard with suggestions.
* [ ] **Implement variance‑based auto‑match logic** – Auto‑accept matches within user‑defined variance threshold (e.g., 5%); route others to AI Wizard for manual review.
* [ ] **Track AI decision history** – For each AI suggestion, store accepted/rejected decisions and supporting fields for future learning and audit.

---

### G. History / Bulk Actions / Reassignment

#### G1. History tab & audit logging

* [ ] **Implement History tab on Opportunities, Products, Revenue Schedules** – Read‑only audit log with Date, User, Action, Field, Old Value, New Value; no delete/undo from history.
* [ ] **Log key bulk actions** – Ensure bulk product/schedule edits, bulk inactivations/deletions, and mass commission rate changes all write entries into History with prior/new values.

#### G2. Bulk actions UI

* [ ] **Implement 2×2 bulk actions grid** – On main list pages where bulk actions exist (Products, Revenue Schedules, possibly Accounts/Opportunities): grid for Delete, Reassign, Active/Inactive, Export; icons disabled until at least one row selected, with tooltips.
* [ ] **Replace floating “Manage” bar with consistent bulk dialog** – For lists currently using an easily missed floating bar, move to explicit Manage button + popup or side panel.
* [ ] **Implement bulk status dropdowns** – For Active/Inactive changes and other simple bulk field updates, provide dropdowns + “Apply” button, ensuring effective date is captured where required (e.g., schedule rate changes).

#### G3. User reassignment admin tool

* [ ] **Create dedicated House Rep Replacement admin page** – Replace reassignment modal with a page that:

  * Lets admin select Previous User and auto‑set effective reassignment date to the **1st of the removal month**.
  * Choose New House Rep for global reassignment.
  * Shows preview tables for all objects impacted (Accounts, Contacts, Opportunities, Tasks, Tickets, Activities, Notes, Groups).
* [ ] **Implement reassignment options for in‑flight opportunities** – For each pipeline opportunity:

  * Option A: reassign to New House Rep with full commission.
  * Option B: convert to House Account where House gets the previous user’s commission portion from the effective date forward.
* [ ] **Apply commission split changes on reassignment** – For opportunities with schedules: convert Previous User’s future commission share to House (or new rep) from the effective date, preserving Subagent splits and historical reconciled records.
* [ ] **Create “No House Rep” contact** – Add a dummy “No House Rep” contact tied to the parent agency account and use it as `house_rep` for schedules converted entirely to House with no individual rep.
* [ ] **Reassignment UI polish** – Update reassignment controls per notes: radios for options, default to new owner, require Commission Adjustment, show counts of impacted records, remove redundant middle step, remove bulk “Reassign” button from other menus.

---

### H. Admin / User Management & Settings

* [ ] **Fix Account Owner dropdown bug** – Ensure Account Owner picklist pulls from current users (House Contact Type), refreshes dynamically when new users are created, and is sorted A–Z by last name.
* [ ] **Implement user invite/activation email** – When a new user is created/activated, send an email (from Rob’s domain) with login instructions.
* [ ] **Update Admin/Settings permissions** – Extend role/permissions matrix to cover new features (Deposits page, Reconciliation, AI Wizard, Bulk actions, History).

---

### I. Tickets, Groups, Activities, Reports

* [ ] **Centralize Ticket creation on Revenue Schedule detail** – Only allow ticket creation from the Revenue Schedule detail view, auto‑populating Opportunity, Product, Vendor, Distributor. Default Ticket Status to “Active” and add Ticket # column on relevant tables.
* [ ] **Add Tickets tab to Revenue Schedule detail** – Mirror Activities/Notes style; list tickets related to that schedule only.
* [ ] **Build Group detail page and hyperlinks** – From Groups list, hyperlink group names to a detailed Group page with members, related accounts/opportunities, and activities.
* [ ] **Refine Activities & Notes “Create New” popups** – Use tabbed popups matching main Activities/Notes UI; ensure fields match the Excel spec including Attachments.

---

## PHASE LATER – Revenue Schedule Detail Redesign & Global UX Polish

### J. Revenue Schedule Detail Page Redesign (Deferred / Change Order)

* [ ] **Redesign Revenue Schedule detail into 3‑column layout** (new change order, currently deferred until after reconciliation is stable):

  * Move address & payment fields to a right‑hand column.
  * Add Notes and Tickets sections in the right column.
  * Consolidate tabs into a horizontal layout for consistency.
* [ ] **Rework Financial Summary layout** – Move Receivables under Reconciled, refine separators and backgrounds (e.g., light blue for commission split section), ensure payments and splits are visually clear.

---

### K. Global UI/UX & Formatting

* [ ] **Standardize modal sizes (~80% width)** across the app; ensure dropdowns are visible and scrollable in all long lists.
* [ ] **Global date formatting** – Verify all dates across modules use `YYYY‑MM‑DD` (or `YYYY‑MM` where period format is intended).
* [ ] **Phone number formatting** – Auto‑format phone fields as `XXX‑XXX‑XXXX` and shorten phone/mobile field widths; ensure extension and new Contact ID fields are aligned.
* [ ] **Tab order normalization** – For all forms, initial focus on Account Name (where present), with tabbing proceeding down column 1 then column 2; fix any left‑to‑right anomalies.
* [ ] **Global label and placeholder cleanup** –

  * Field labels & table headers in ALL CAPS.
  * Placeholders in Proper Case (e.g., “Select Distributor”).
  * Fix mis‑labeled items like “Product Subtype – House” → “House – Product Subtype”.
* [ ] **Hyperlink key references** – Ensure Account Name, Product Name, Distributor, Vendor, Opportunity Name columns link to their respective detail pages in all relevant tables.
* [ ] **Improve scrollbars & horizontal scrolling in tables** – Especially on tabs like Account > Opportunities and global lists; ensure horizontal scrollbars are always available and don’t require awkward hovering.

---

