# Commissable CRM – Master Engineering Task List (Status Snapshot 2025-12-07)

Source docs:
- `12-7-25-Master-Task-List-2.md` (structure and task wording)
- `12-7-25-OLD-Task-List.md` (codes + statuses like REC-01, RS-02, etc.)
- Reconciliation and implementation notes (`reconciliation_matching_status_summary.md`, `Product_Inactivation_Deletion.md`, `12-4-25-Deposit-Upload-Implementation-Summary.md`, `Commission_Reassignment_Implementation_Plan.md`, etc.)

Status legend:
- `[ ]` Not started / no implementation work yet
- `[~]` In progress / partially implemented
- `[x]` Functionally implemented (may still have minor polish or follow-ups)

Milestone tags:
- `[M1]` Reconciliation core (UI + engine) and minimal deposit workflow
- `[M2]` Revenue Schedules hardening (lists, cloning, manual lifecycle)
- `[M3]` Product Catalog / Add/Create Product and product data integrity
- `[M4]` Admin, permissions, history, bulk actions, reassignment, undo
- `[M5]` AI matching and AI Wizard workflows
- `[M6]` Deferred detail redesign and global UI/UX polish

This file is a status overlay for `12-7-25-Master-Task-List-2.md` rather than a replacement spec. Use this to see what is done vs in flight, and which milestone (M1–M6) each item belongs to; then jump back to the master list for full wording and detail.

For each item, **Cross-ref** lines tell you exactly where it lives:
- **Master** = `12-7-25-Master-Task-List-2.md` section
- **Old** = `12-7-25-OLD-Task-List.md` code(s), when applicable

---

## PHASE NOW – Unblock Reconciliation & Stabilize Core Data

### A. Data Integrity & Core Constraints

- [ ] [M3] Enforce product creation constraints  
  Status: TODO – No explicit implementation status yet; product creation still behaves per older specs.  
  Cross-ref: Master A-1; related product-create gaps in `Markdown-Notes/Products_Implementation_Status_Report.md`.

- [x] [M3] Add “None-Direct” Distributor account  
  Status: DONE – Auto-creates an active `None-Direct` distributor per tenant and uses it as the fallback when a product or opportunity line item has a vendor but no distributor (product create/update, product options, and opp line-item creation all backfill).  
  Cross-ref: Master A-2; code: `lib/none-direct-distributor.ts`, `/api/products/options`, `/api/products`, `/api/products/[productId]`, `/api/opportunities/[opportunityId]/line-items`.

- [x] [M2] Fix orphaned revenue schedules on product delete  
  Status: DONE – Opportunity product delete now hard-deletes related revenue schedules only when no monies are applied (usage/commission/adjustments, matches/recon/deposit links); otherwise deletion is blocked.  
  Cross-ref: Master A-3; Old RS-03; code: `app/api/opportunities/line-items/[lineItemId]/route.ts`.

- [x] [M1] Gate revenue schedule deletion  
  Status: DONE – DELETE `/api/revenue-schedules/{id}` now allows only Admin/Accounting roles and blocks deletion when any usage/commission is applied or when matches/reconciliation/deposit links exist; otherwise deletes with FK-safe cleanup.  
  Cross-ref: Master A-4; Old RS-03; code: `app/api/revenue-schedules/[revenueScheduleId]/route.ts`.

- [x] [M1] Implement product deletion gating  
  Status: DONE – Product DELETE API now blocks when any revenue schedules exist (past or future) and instructs users to inactivate instead; delete proceeds only when no schedules exist.  
  Cross-ref: Master A-5; Old RS-03 (product-side guard); code: `app/api/products/[productId]/route.ts`.

- [ ] [M3] Account-type filtering for Distributor/Vendor dropdowns  
  Status: TODO – Specs call for account-type constrained dropdowns, but there is no tracked implementation status.  
  Cross-ref: Master A-6; see field definitions in `Commissable - Global - Fields by Page(Fields by Page) (3).csv`.

---

### B. Product Catalog & Product Creation (Global + Opportunity)

- [~] [M3] Catalog list & detail clean-up (rename to “Catalog”, standardized detail layout, Revenue Type enforcement, auto-formatted money/percent, status filters)  
  Status: IN PROGRESS – Products main list and detail are largely implemented (`Markdown-Notes/Products_Implementation_Status_Report.md`); Revenue Type enums are wired end-to-end (`Revenue_Type_fields.md`), but the “Catalog” naming, some layout tweaks, and admin editability for Family/Subtype remain.  
  Cross-ref: Master B1-1–B1-5; Old CAT-02.

- [ ] [M3] Catalog bulk tools (mass commission rate adjustment, “no revenue schedules” filter)  
  Status: TODO – Design is in the master list, but nothing is tracked as implemented.  
  Cross-ref: Master B1-6–B1-8.

- [ ] [M3] Opportunity “Add/Create Product” flow (two-mode popup, fixed dropdowns/tab order, correct selection flow, inline schedule creation, Product Billing Status column)  
  Status: TODO – The Opportunity product popup exists and is partially wired (`Markdown-Notes/Opportunities_Implementation_Status_Report.md`), but the two-mode Add/Create flow and schedule-creation step are not in production.  
  Cross-ref: Master B2-1–B2-8; Old CAT-01, CAT-02.

---

### C. Revenue Schedules – Lists, Tables & Cloning

- [ ] [M2] Revenue Schedule tables polish (date format, key columns, sorting, widths, select-all, money/percent formatting, filter layout)  
  Status: TODO – These C1 refinements correspond to the list/table plans and are not tracked as complete; RS-01–RS-03 remain open.  
  Cross-ref: Master C1-1–C1-7; Old RS-01–RS-03; `Markdown-Notes/Revenue_Schedules_List_Update_Plan.md`.

- [ ] [M2] Bulk management & inline editing (global “Manage” bulk actions, Opp-level bulk rate change, recalculation of dependent fields)  
  Status: TODO – `revenue-schedules-opportunity-status-and-plan.md` describes working UI prototypes and intended bulk APIs, but the APIs and “effective date forward” semantics are not implemented.  
  Cross-ref: Master C2-1–C2-3; Old RS-01/RS-02.

- [ ] [M2] Cloning & extending schedules (multi-period copy/extend, standardized Clone modal)  
  Status: NEEDS REVIEW – `12-4-25-Clone-Revenue-Schedule-Implementation-Summary.md` marks the enhanced clone flow as COMPLETED, but RS-01/RS-02 are still TODO in the OLD list; behavior should be validated against the newer spec before marking fully done.  
  Cross-ref: Master C3-1–C3-2; Old RS-01, RS-02; clone implementation summary doc.

- [ ] [M6] Auto-generation & lifecycle (auto-create next month, schedule inactivation, “In Dispute” flag wiring)  
  Status: TODO – Month-to-month lifecycle design exists (`Revenue Schedule Month to Month Design.docx.md`), but no evidence of a production job or schedule inactivation/“In Dispute” toggle wiring yet.  
  Cross-ref: Master C4-1–C4-3; Old RS-06 (test cases).

---

### D. Reconciliation – Deposit Upload & Core Matching UI

- [ ] [M1] Deposit list & upload UX (focused admin workspace, period selector, period metrics header, standardized auto-name, Commission Period field, cleaner upload form)  
  Status: PARTIAL/TODO – The new deposit upload wizard + import API are implemented (`12-4-25-Deposit-Upload-Implementation-Summary.md`), but DEP-01–DEP-03 are still TODO and the summary/header polish is not tracked as complete.  
  Cross-ref: Master D1-1–D1-6; Old DEP-01–DEP-03.

- [~] [M1] Per-deposit reconciliation workspace (two-table layout, consolidated Deposit Status, “Match Selected Items” button, inline schedule editing, filter dropdowns, visual match highlights, Match/Unmatch/Reconcile/Unreconcile flows)  
  Status: IN PROGRESS – REC-01–REC-03 are IN PROGRESS in the old list; `reconciliation_matching_status_summary.md` shows candidate retrieval, Pass A/B matching, match/unmatch flows, and status engine as Done, but some UI polish (highlights, filters, headers) remains.  
  Cross-ref: Master D2-1–D2-8; Old REC-01, REC-02, REC-03.

- [ ] [M4] Undo control for reconciliation  
  Status: TODO – No per-line Undo exists yet; the global undo design (ADM-02) is still an open decision.  
  Cross-ref: Master D2-9; Old ADM-02.

---

### E. Data & Testing Support

- [ ] [M1] Seed mini dataset for smoke tests (vendors, opportunities, products, schedules, deposits)  
  Status: TODO – DEP-02 (“Add sample deposit line items for testing”) is still TODO; there is no documented seed script/dev dataset.  
  Cross-ref: Master E-1; Old DEP-02.

- [ ] [M1] Add richer deposit line items for AI/reconciliation testing  
  Status: TODO – Same gap as above; partial/over/under/multi-period scenarios for AI and reconciliation are not seeded yet.  
  Cross-ref: Master E-2; Old DEP-02; AI behavior in REC-04.

- [ ] [M4] Verify schedule reassignment behavior across 1st-of-month boundaries  
  Status: TODO – RS-06 is TODO; these edge-case tests for reassignment and effective dates are still pending.  
  Cross-ref: Master E-3; Old RS-06; `Commission_Reassignment_Implementation_Plan.md`.

---

## PHASE NEXT – AI Matching, History, Admin Tools & Advanced Workflows

### F. AI Matching & “AI Wizard” Page

- [ ] [M5] Build AI Wizard manual review page  
  Status: TODO – No dedicated Wizard page exists; current flows use the reconciliation detail + a preview modal.  
  Cross-ref: Master F-1; design direction in `12-4-25-LLM-AIAgent-Implementation-Plan.md`.

- [~] [M5] Manual AI trigger from reconciliation UI  
  Status: IN PROGRESS – “Run AI Matching” button and Pass A preview/confirm auto-match flow exist; this is surfaced via REC-04 and the AI Matching section of the status summary.  
  Cross-ref: Master F-2; Old REC-04; `reconciliation_matching_status_summary.md`.

- [~] [M5] Variance-based auto-match logic  
  Status: IN PROGRESS – Per-tenant variance setting and Pass A auto-match endpoint are implemented and wired into the UI; broader variance policies and Pass B auto-apply are still partial.  
  Cross-ref: Master F-3; Old REC-04; “AI / Auto-Match & Variance” in `reconciliation_matching_status_summary.md`.

- [~] [M5] Track AI decision history  
  Status: IN PROGRESS – Matching metrics and audit logging via `logMatchingMetric` exist, but richer AI decision history/analytics are still manual.  
  Cross-ref: Master F-4; “Observability & tuning” in `reconciliation_matching_status_summary.md`.

---

### G. History / Bulk Actions / Reassignment

- [~] [M4] History tab and audit logging for Opportunities, Products, Revenue Schedules  
  Status: IN PROGRESS – Opportunities and Products have working History tabs and audit logs; Revenue Schedules and some schedule-driven split changes are not fully audited yet.  
  Cross-ref: Master G1-1; Old list (implicit under ADM-03 / RS items); history components in `components/audit-history-tab.tsx`.

- [~] [M4] Log key bulk actions  
  Status: IN PROGRESS – Product inactivation/deletion bulk operations log to History (`Product_Inactivation_Deletion.md`), but a full policy across schedules and other entities is not yet documented.  
  Cross-ref: Master G1-2; relates to product bulk actions and any future revenue-schedule bulk APIs.

- [ ] [M4] Bulk actions UI (2A-2 grid, replace floating Manage bar, bulk status dropdowns)  
  Status: TODO – Bulk-actions specs exist (`bulk-actions-header-buttons-spec.md`, `bulk-action-bar-overlay-guide.md`), but there is no cross-module implementation status yet.  
  Cross-ref: Master G2-1–G2-3.

- [ ] [M4] User reassignment admin tool (House Rep Replacement page, in-flight options, split changes, “No House Rep” contact, UI polish)  
  Status: TODO – `Commission_Reassignment_Implementation_Plan.md` shows Level 2 account-level reassignment is implemented, but the dedicated admin page, Level 1/3 flows, and the detailed options in the new G3 spec are still missing.  
  Cross-ref: Master G3-1–G3-5; Old ADM-01, ADM-03; reassignment plan doc.

---

### H. Admin / User Management & Settings

- [ ] [M4] Fix Account Owner dropdown bug  
  Status: TODO – Owner dropdown still needs to pull from the correct eligible user set and auto-refresh as new users are added.  
  Cross-ref: Master H-1; Old ADM-04.

- [ ] [M4] Implement user invite/activation email  
  Status: TODO – No implementation status recorded; new work.  
  Cross-ref: Master H-2.

- [ ] [M4] Update Admin/Settings permissions for new features  
  Status: TODO – Reconciliation, deposit upload, revenue schedule delete, reassignment, tickets, AI, and bulk/history permissions are not yet formalized in a single matrix.  
  Cross-ref: Master H-3; Old ADM-03.

---

### I. Tickets, Groups, Activities, Reports

- [ ] [M6] Centralize Ticket creation on Revenue Schedule detail  
  Status: TODO – No evidence that ticket creation is locked to the schedule detail with auto-populated context.  
  Cross-ref: Master I-1.

- [ ] [M6] Add Tickets tab to Revenue Schedule detail  
  Status: TODO – Still pending as RS-05 in the OLD list.  
  Cross-ref: Master I-2; Old RS-05.

- [ ] [M6] Build Group detail page and hyperlinks  
  Status: TODO – No implementation status for a Group detail page with member and related-records lists.  
  Cross-ref: Master I-3.

- [ ] [M6] Refine Activities & Notes “Create New” popups  
  Status: TODO – Activities/Notes flows work, but the new tabbed popup spec with full Excel-spec fields and attachments is not tracked as complete.  
  Cross-ref: Master I-4; activities specs in `Markdown-Notes` (Activities/Notes docs).

---

## PHASE LATER – Revenue Schedule Detail Redesign & Global UX Polish

### J. Revenue Schedule Detail Page Redesign (Deferred / Change Order)

- [ ] [M6] Redesign Revenue Schedule detail into 3-column layout  
  Status: DEFERRED/TODO – RS-04 remains TODO and is explicitly deferred until reconciliation is stable.  
  Cross-ref: Master J-1; Old RS-04.

- [ ] [M6] Rework Financial Summary layout  
  Status: DEFERRED/TODO – Same deferred change order; no implementation work tracked yet.  
  Cross-ref: Master J-2; see Financial Summary notes in reconciliation / revenue-schedule docs.

---

### K. Global UI/UX & Formatting

- [ ] [M6] Standardize modal sizes (~80% width)  
  Status: TODO – No global modal normalization work is documented.  
  Cross-ref: Master K-1.

- [~] [M6] Global date formatting  
  Status: IN PROGRESS – UI-04 is IN PROGRESS; reconciliation views use consistent formats, but a full app-wide sweep is pending.  
  Cross-ref: Master K-2; Old UI-04.

- [ ] [M6] Phone number formatting  
  Status: TODO – Auto-formatting as `XXX-XXX-XXXX` and associated width tweaks are not recorded as implemented.  
  Cross-ref: Master K-3.

- [ ] [M6] Tab order normalization  
  Status: TODO – No systematic tab-order normalization across forms is documented.  
  Cross-ref: Master K-4.

- [ ] [M6] Global label and placeholder cleanup  
  Status: TODO – ALL-CAPS labels + Proper-Case placeholders are a spec goal; no project-wide implementation status yet.  
  Cross-ref: Master K-5.

- [ ] [M6] Hyperlink key references  
  Status: TODO – Many tables already hyperlink key names, but there is no “all tables complete” marker.  
  Cross-ref: Master K-6.

- [ ] [M6] Improve scrollbars & horizontal scrolling in tables  
  Status: TODO – Scrollbar/overflow polish is still a general UX to-do.  
  Cross-ref: Master K-7.

