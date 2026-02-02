# Commissable CRM — Ticket-ready Log
Meetings covered: **2026-01-21**, **2026-01-22**, **2026-01-26**
Generated: **2026-02-02**
Progress audit: **2026-02-02**

## Conventions
- **Priority**: P0 (blocking end-to-end reconciliation), P1 (important UX/ops), P2 (nice-to-have / future).
- **Source**: meeting date.
- **ASSUMED** = not explicitly stated in meeting, but inferred to make the ticket implementable.
- **Status**: Done, In progress, Not started, Blocked (needs input), Needs verification, Needs confirmation.

---

## Quick import (compact)
| Ticket | Title | Priority | Epic/Area | Source | Status |
|---|---|---:|---|---|---|
| CRM-DEP-001 | Deposit mapping UI: suggested match + prevent duplicate maps + taller table | P0 | Deposit Upload | 2026-01-21 | In progress |
| CRM-DEP-002 | Mapping review restyle: Mapped/Unmapped tabs + row count + remove sample rows | P1 | Deposit Upload | 2026-01-21 | Done |
| CRM-DEP-003 | Merge “Review” step into mapping page | P0 | Deposit Upload | 2026-01-21 | Done |
| CRM-DEP-004 | Disable auto-selection of first deposit line item | P1 | Deposit Detail | 2026-01-21 | Done |
| CRM-DEP-005 | PDF support for deposit workflow (upload and/or export) | P1 | Deposit Upload | 2026-01-22 | Blocked (needs input) |
| CRM-DEP-006 | Multi-vendor upload option + parsing (skip Totals) | P0 | Deposit Upload | 2026-01-26 | Not started |
| CRM-DEP-007 | Deposit verification fields: Received Amt/Date/By + relabel Report Date | P0 | Deposit Detail | 2026-01-26 | Done |
| CRM-DEP-008 | Deposit detail: vendor summary widget (allocated/unallocated by vendor) | P1 | Deposit Detail | 2026-01-26 | Not started |
| CRM-REC-001 | Reconciliation: enable multi-select | P0 | Reconciliation UI | 2026-01-21 | Done |
| CRM-REC-002 | Reconciliation: default view = Unmatched; remove “Suggested” tab | P1 | Reconciliation UI | 2026-01-21 | Done |
| CRM-REC-003 | Fix reconciliation summary scrollbar | P2 | Reconciliation UI | 2026-01-21 | Needs verification |
| CRM-REC-004 | Frozen columns + single synced horizontal scroll (top/bottom grids) | P1 | Reconciliation UI | 2026-01-26 | Blocked (needs input) |
| CRM-REC-005 | Fix column wrapping + currency formatting in reconciliation tables | P1 | Reconciliation UI | 2026-01-26 | Done |
| CRM-REC-006 | Bottom grid must respond to top filters (dynamic filtering) | P0 | Reconciliation UI | 2026-01-26 | Done |
| CRM-REC-007 | Fix commission rate display/calculation in reconciliation | P0 | Reconciliation Calc | 2026-01-26 | Done |
| CRM-REC-008 | Add Account Legal Name to mapping + Account Name to bottom grid | P1 | Reconciliation UI | 2026-01-26 | In progress |
| CRM-MATCH-001 | Matching logic: ensure Account Legal Name + Order/Customer/House IDs are used | P0 | Matching | 2026-01-21 | Done |
| CRM-MATCH-002 | Match-type validation wizard for 1:M / M:1 / M:M (with progress bars) | P0 | Matching | 2026-01-22 | Not started |
| CRM-MATCH-003 | Comma-separated IDs parsing + admin edits + unmatch reversal for metadata | P1 | Matching | 2026-01-22 | Not started |
| CRM-MATCH-004 | Diagnose/fix “Unmatched schedules” not showing via test script | P0 | Matching | 2026-01-26 | Not started |
| CRM-MATCH-005 | Improve AI match confidence behavior + build test schedules (e.g., VoIP) | P1 | Matching | 2026-01-26 | Not started |
| CRM-FLOW-001 | Draft/implement bundle/split logic spec (workflow + rules) | P0 | Matching Workflow | 2026-01-21 | Blocked (needs input) |
| CRM-FLEX-001 | Chargebacks: manager approval workflow + status “In Dispute” | P0 | Chargebacks | 2026-01-22 | In progress |
| CRM-FLEX-002 | Collections workflow triggered from Underpaid status | P1 | Collections | 2026-01-22 | Not started |
| CRM-FLEX-003 | Billing Status field + consistent statuses across entities | P0 | Status Model | 2026-01-22 | In progress |
| CRM-FLEX-004 | Flex resolution: one-time vs recurring; create additional schedules; prompt family/subtype | P0 | Flex | 2026-01-22 | In progress |
| CRM-RS-001 | Fix “Go to revenue schedule” link | P2 | Revenue Schedules | 2026-01-21 | Needs verification |
| CRM-RS-002 | Opportunity: add “Extend Contract” action on Revenue Schedules tab | P1 | Revenue Schedules | 2026-01-21 | Not started |
| CRM-RS-003 | Add “Change Start Date” tab (single-product), prompt reason, export order/visibility fix | P1 | Revenue Schedules | 2026-01-22 | Not started |
| CRM-OPP-001 | Opportunity Products: add “Number of Periods” column | P2 | Opportunities | 2026-01-22 | Not started |
| CRM-TIX-001 | Tickets: add Vendor Ticket ID + Vendor Contact lookup; rename fields; auto-set Created By | P1 | Tickets | 2026-01-26 | Done |
| CRM-QA-001 | Send manual + automated UAT checklists and notes | P1 | QA/UAT | 2026-01-21 | Needs confirmation |
| CRM-QA-002 | Run end-to-end reconciliation test with Debra using real files | P0 | QA/UAT | 2026-01-22 | Needs confirmation |
| CRM-MIG-001 | Data migration approach: “Historical Transaction” placeholder product per account | P1 | Migration | 2026-01-26 | Not started |

## Progress snapshot (as of 2026-02-02)

### P0 readiness (blocking end-to-end reconciliation)
- **Done / largely implemented:** CRM-DEP-003, CRM-DEP-007, CRM-REC-001, CRM-REC-006, CRM-REC-007, CRM-MATCH-001
- **In progress:** CRM-DEP-001, CRM-FLEX-001, CRM-FLEX-003, CRM-FLEX-004, CRM-REC-008
- **Not started / blocked:** CRM-DEP-006, CRM-MATCH-002, CRM-MATCH-004, CRM-FLOW-001, CRM-QA-002

### Key gaps vs acceptance criteria (from the context pack)
- **Multi-vendor deposit upload** (CRM-DEP-006) remains a hard blocker for “single report with multiple vendors” workflows.
- **Non-1:1 match wizard** (CRM-MATCH-002) is not implemented yet; acceptance tests that require 1:M / M:1 / M:M will fail until this exists.
- **Frozen columns + synced horizontal scroll** (CRM-REC-004) still needs exact “key columns” selection and implementation.
- **Chargeback approval UX** (CRM-FLEX-001) is in progress; confirm reject path + “In Dispute” labeling semantics match the meetings.
- **PDF workflow** (CRM-DEP-005) is blocked until scope is confirmed (upload, export, or both).

### Acceptance test coverage (context pack §7)
- A) Single-vendor deposit upload: Mostly supported; verify CRM-DEP-001 (duplicate-map enforcement) end-to-end.
- B) Multi-vendor deposit upload: Blocked by CRM-DEP-006.
- C) Reconciliation multi-select + match wizard: Multi-select is supported (CRM-REC-001); wizard is not yet (CRM-MATCH-002).
- D) Chargeback manager approval: In progress (CRM-FLEX-001).
- E) Flex resolution: In progress (CRM-FLEX-004).

### Suggested validation runs (copy/paste)
See `docs/commissable_cursor_context_2026-01-21_22_26.md` §7 for acceptance tests A–E; schedule CRM-QA-002 once remaining P0 gaps are closed.

---

## EPIC A — Deposit Upload, Templates, and Deposit Detail

### CRM-DEP-001 — Deposit mapping UI: suggested match + prevent duplicate maps + taller table
**Priority:** P0  
**Source:** 2026-01-21  
**Status:** In progress

**Description**
Update the deposit mapping UI to make mapping faster and safer:
- Add a **Suggested Match** column.
- Prevent users from mapping the same system field more than once.
- Increase the mapping table height and improve column layout.

**Acceptance Criteria**
- Suggested matches are visible per row/field and do not block manual override.
- UI prevents duplicate system-field selections (inline validation + clear error message).
- Mapping table displays at the requested height without horizontal layout breakage at standard laptop widths.

**Dependencies / Notes**
- Ensure this works with existing template fetch/save behavior.

---

### CRM-DEP-002 — Mapping review restyle: Mapped/Unmapped tabs + row count + remove sample rows
**Priority:** P1  
**Source:** 2026-01-21  
**Status:** Done

**Description**
Restyle the mapping review UX:
- Two tabs: **Mapped** and **Unmapped**.
- Remove sample rows.
- Use a 3-column layout.
- Add a row count.

**Acceptance Criteria**
- Tabs correctly partition mapped vs unmapped rows.
- Row counts match underlying data.
- Sample/dummy rows are removed.

---

### CRM-DEP-003 — Merge “Review” step into mapping page
**Priority:** P0  
**Source:** 2026-01-21  
**Status:** Done

**Description**
Remove the separate “Review” step and integrate review inline in the main field-mapping page.

**Acceptance Criteria**
- Users can complete mapping + review without leaving the page.
- “Finalize/Next” actions still work and the wizard state is preserved.

---

### CRM-DEP-004 — Disable auto-selection of first deposit line item
**Priority:** P1  
**Source:** 2026-01-21  
**Status:** Done

**Description**
Stop the UI from automatically selecting the first deposit line item when entering deposit detail / reconciliation.

**Acceptance Criteria**
- No line item is selected by default when the user lands on the screen.
- Keyboard/mouse selection still works normally.

---

### CRM-DEP-005 — PDF support for deposit workflow (upload and/or export)
**Priority:** P1  
**Source:** 2026-01-22  
**Status:** Blocked (needs input)

**Description**
Add PDF-related functionality in deposit workflow.

**ASSUMED split (needs confirmation)**
1) **PDF upload support** for deposits (current upload supports Excel/CSV).  
2) **PDF export** of deposit details / reconciliation summary.

**Acceptance Criteria**
- Upload: user can upload a PDF file and proceed through mapping to create deposits/lines (if PDF is machine-readable, parse; if not, surface actionable error).
- Export (if in scope): user can export a selected deposit to PDF and the PDF includes deposit header + line items + totals.

---

### CRM-DEP-006 — Multi-vendor upload option + parsing (skip Totals)
**Priority:** P0  
**Source:** 2026-01-26  
**Status:** Not started

**Description**
Add a “multi-vendor” option on deposit upload to process a single report containing multiple vendors.
- System uses vendor name per row to apply correct template.
- Pre-work: be able to ignore non-transactional rows like “Total” lines.

**Acceptance Criteria**
- Upload screen includes “Multi-vendor” toggle/option.
- File ingestion:
  - Non-transaction rows are skipped.
  - Each transactional row is assigned to the correct Vendor (and Distributor→Vendor is set).
- Deposits/lines created successfully without requiring manual file-splitting.

---

### CRM-DEP-007 — Deposit verification fields: Received Amt/Date/By + relabel Report Date
**Priority:** P0  
**Source:** 2026-01-26  
**Status:** Done

**Description**
Add a workflow to verify what the bank actually received vs the vendor report:
- Add fields: **Payment Received Date**, **Actual Confirmed Deposit Amount**, **Received By**.
- Relabel existing “Date” to **Report Date**.
- Shrink top text areas to free space for the new fields.

**Acceptance Criteria**
- Deposit detail screen displays these 3 new fields.
- Fields are editable only by allowed roles (ASSUMED: admin/accounting).
- Report Date label updated.
- UI layout remains readable and avoids overflow/wrapping issues.

---

### CRM-DEP-008 — Deposit detail: vendor summary widget (allocated/unallocated by vendor)
**Priority:** P1  
**Source:** 2026-01-26  
**Status:** Not started

**Description**
Add a vendor summary widget on deposit detail so Debra can reconcile vendor-by-vendor and see progress (allocated/unallocated counts and totals).

**Acceptance Criteria**
- Widget shows per vendor:
  - line count (total + allocated/unallocated)
  - usage totals (allocated/unallocated)
  - commission totals (allocated/unallocated)
- Updating filters (e.g., vendor filter) updates the widget appropriately (ASSUMED).

---

## EPIC B — Reconciliation UI / Workbench

### CRM-REC-001 — Reconciliation: enable multi-select
**Priority:** P0  
**Source:** 2026-01-21  
**Status:** Done

**Description**
Enable multi-select on reconciliation page to support multi-line matching workflows.

**Acceptance Criteria**
- User can select multiple deposit lines.
- Bulk actions (Match, Split, etc.) become available only when valid selections exist.

---

### CRM-REC-002 — Reconciliation: default view = Unmatched; remove “Suggested” tab
**Priority:** P1  
**Source:** 2026-01-21  
**Status:** Done

**Description**
Set default reconciliation view to **Unmatched** and remove the “Suggested” tab.

**Acceptance Criteria**
- Landing view shows Unmatched items.
- “Suggested” tab is removed or hidden without breaking navigation.

---

### CRM-REC-003 — Fix reconciliation summary scrollbar
**Priority:** P2  
**Source:** 2026-01-21  
**Status:** Needs verification

**Description**
Fix the reconciliation summary scrollbar issues.

**Acceptance Criteria**
- Scroll behavior works across common browsers.
- No overlapping scroll regions or clipped content.

---

### CRM-REC-004 — Frozen columns + single synced horizontal scroll (top/bottom grids)
**Priority:** P1  
**Source:** 2026-01-26  
**Status:** Blocked (needs input)

**Description**
Improve matching usability by locking key columns and syncing horizontal scroll between the top and bottom grids.
- Keep key columns frozen.
- Use a single horizontal scrollbar to move both grids together.
- Provide a “lock comparison view” toggle/button (ASSUMED based on discussion).

**Acceptance Criteria**
- Frozen columns remain visible while scrolling right.
- Top and bottom grids maintain column alignment when lock/toggle is enabled.
- Users can still re-order non-frozen columns without breaking the frozen set.

---

### CRM-REC-005 — Fix column wrapping + currency formatting in reconciliation tables
**Priority:** P1  
**Source:** 2026-01-26  
**Status:** Done

**Description**
- Fix incorrect/ugly column wrapping.
- Format money fields as dollars.

**Acceptance Criteria**
- Currency fields render consistently with $ formatting.
- Column headers/cells wrap or truncate consistently; no broken layout.

---

### CRM-REC-006 — Bottom grid must respond to top filters (dynamic filtering)
**Priority:** P0  
**Source:** 2026-01-26  
**Status:** Done

**Description**
Ensure the revenue schedule bottom grid updates based on top filters (e.g., status/unmatched, vendor filter).

**Acceptance Criteria**
- When the user changes filters in the top section, the bottom grid results change accordingly.
- No stale data after filter changes.

---

### CRM-REC-007 — Fix commission rate display/calculation in reconciliation
**Priority:** P0  
**Source:** 2026-01-26  
**Status:** Done

**Description**
Fix incorrect commission rate display and/or calculation in reconciliation.

**Acceptance Criteria**
- Commission rate shown matches the expected calculation source-of-truth for the selected match.
- No mismatch between displayed rate and saved values.

---

### CRM-REC-008 — Add Account Legal Name to mapping + Account Name to bottom grid
**Priority:** P1  
**Source:** 2026-01-26  
**Status:** In progress

**Description**
- Add **Account Legal Name** as a mapping option.
- Show **Account Name** in the bottom grid.

**Acceptance Criteria**
- Mapping dropdown includes Account Legal Name.
- Bottom grid includes Account Name and supports filtering/search as applicable.

---

## EPIC C — Matching Logic & Workflow

### CRM-MATCH-001 — Matching logic: ensure Account Legal Name + Order/Customer/House IDs are used
**Priority:** P0  
**Source:** 2026-01-21  
**Status:** Done

**Description**
Investigate and fix matching logic failures, focusing on:
- Account Legal Name
- Other ID / House ID fields
- Ensuring matching uses Account Legal Name + Order/Customer/House IDs.

**Acceptance Criteria**
- Given a known-good test deposit + schedules, auto-suggestions appear and matching succeeds.
- When Account Legal Name and relevant IDs are present, they are used in candidate retrieval/scoring.

---

### CRM-FLOW-001 — Draft/implement bundle/split logic spec (workflow + rules)
**Priority:** P0  
**Source:** 2026-01-21  
**Status:** Blocked (needs input)

**Description**
Draft (and then implement) the bundle/split logic requirements for complex matching (1:M, M:1, M:M).

**Acceptance Criteria**
- Written workflow spec exists and is reflected in UI behavior.
- System supports the defined bundle/split scenarios without corrupting allocations.

**Dependencies / Notes**
- Dependent on Rob providing bundle/split logic details.

---

### CRM-MATCH-002 — Match-type validation wizard for 1:M / M:1 / M:M (with progress bars)
**Priority:** P0  
**Source:** 2026-01-22  
**Status:** Not started

**Description**
Add a validation layer so the app detects match type and launches the correct wizard:
- Identify whether user is attempting 1:1, 1:M, M:1, or M:M.
- Trigger a guided wizard for non-1:1 cases.
- Add progress bars / step indicators.

**Acceptance Criteria**
- On “Match” click, system classifies match type from current selections.
- If match type != 1:1, user is shown the appropriate wizard flow.
- Wizard blocks invalid submissions and explains required inputs.
- Progress indicator reflects wizard step.

---

### CRM-MATCH-003 — Comma-separated IDs parsing + admin edits + unmatch reversal for metadata
**Priority:** P1  
**Source:** 2026-01-22  
**Status:** Not started

**Description**
Implement support for multiple IDs in fields (comma-separated, no-space parsing), allow admin edits, and ensure unmatch reverses metadata updates.

**Acceptance Criteria**
- Input parsing accepts `A,B,C` (and tolerates `A, B, C` by trimming) and stores values consistently.
- Admin users can edit the list.
- If a match action appends/changes IDs, undo/unmatch returns the field to its prior state.

---

### CRM-MATCH-004 — Diagnose/fix “Unmatched schedules” not showing via test script
**Priority:** P0  
**Source:** 2026-01-26  
**Status:** Not started

**Description**
Run a script/report to diagnose why “Unmatched” schedules may not appear under certain filters, then implement the fix.

**Acceptance Criteria**
- Root cause identified (filter mismatch, data issue, query bug, etc.).
- After fix, “Unmatched” schedules appear correctly for known test data.

---

### CRM-MATCH-005 — Improve AI match confidence behavior + build test schedules (e.g., VoIP)
**Priority:** P1  
**Source:** 2026-01-26  
**Status:** Not started

**Description**
- Create test revenue schedules for products like VoIP to validate matching.
- Adjust confidence scoring/presentation to reduce “bad confidence” cases.

**Acceptance Criteria**
- Test dataset exists with VoIP (and other representative products).
- Confidence output aligns with expected matching outcomes on the dataset.

---

## EPIC D — Flex, Chargebacks, Collections, Status Model

### CRM-FLEX-001 — Chargebacks: manager approval workflow + status “In Dispute”
**Priority:** P0  
**Source:** 2026-01-22  
**Status:** In progress

**Description**
Implement manager approval workflow for chargebacks and update chargeback status label to “In Dispute” (currently treated as pending).

**Acceptance Criteria**
- Chargeback items are flagged for review.
- Manager can approve/reject chargebacks.
- Status displayed as “In Dispute” for chargebacks awaiting review.

---

### CRM-FLEX-002 — Collections workflow triggered from Underpaid status
**Priority:** P1  
**Source:** 2026-01-22  
**Status:** Not started

**Description**
Build a collections workflow that triggers when schedules/deposits are Underpaid.

**Acceptance Criteria**
- When an item is marked Underpaid, user can initiate a “Collections” flow (task, ticket, or status progression).
- Workflow supports tracking and resolution states (ASSUMED: Open/In Progress/Resolved).

---

### CRM-FLEX-003 — Billing Status field + consistent statuses across entities
**Priority:** P0  
**Source:** 2026-01-22  
**Status:** In progress

**Description**
Create a Billing Status field and ensure status values are consistent across:
- Products
- Revenue schedules
- Deposit line items
- Deposits
- Reconciliation views

**Acceptance Criteria**
- Billing Status field exists with defined enumerations.
- Status values are aligned “along the tree” and usable for filtering/reporting.

---

### CRM-FLEX-004 — Flex resolution: one-time vs recurring; create additional schedules; prompt family/subtype
**Priority:** P0  
**Source:** 2026-01-22  
**Status:** In progress

**Description**
Implement Flex resolution flow:
- When resolving a Flex item, user selects whether it maps to a one-time or recurring product.
- If recurring, system can create additional schedules.
- When renaming/changing product, prompt for required **family** and **subtype**.

**Acceptance Criteria**
- Flex resolution UI exists and guides the user through product classification.
- If recurring path selected, additional schedules are created according to user inputs.
- Family/subtype required when changing name so filtering works.

---

## EPIC E — Revenue Schedules & Opportunities

### CRM-RS-001 — Fix “Go to revenue schedule” link
**Priority:** P2  
**Source:** 2026-01-21  
**Status:** Needs verification

**Description**
Fix navigation link that takes user to a revenue schedule.

**Acceptance Criteria**
- Link opens the correct revenue schedule record consistently.

---

### CRM-RS-002 — Opportunity: add “Extend Contract” action on Revenue Schedules tab
**Priority:** P1  
**Source:** 2026-01-21  
**Status:** Not started

**Description**
Add a revenue schedule extension action (Extend Contract) on the Opportunity → Revenue Schedules page.

**Acceptance Criteria**
- User can trigger “Extend Contract” for a line item.
- Extension creates additional schedules and preserves history (ASSUMED from schedule extension requirements).

---

### CRM-RS-003 — Add “Change Start Date” tab (single-product), prompt reason, export order/visibility fix
**Priority:** P1  
**Source:** 2026-01-22  
**Status:** Not started

**Description**
Add a Change Start Date tab for single-product scenarios:
- Prompt for reason.
- Fix export order/visibility (ASSUMED: fields and/or columns).

**Acceptance Criteria**
- Users can change schedule start date and see effect on future schedules.
- System requires a reason.
- Export includes the correct fields and ordering.

---

### CRM-OPP-001 — Opportunity Products: add “Number of Periods” column
**Priority:** P2  
**Source:** 2026-01-22  
**Status:** Not started

**Description**
Add “Number of Periods” column to Opportunity Products tab.

**Acceptance Criteria**
- Column displays correct number of periods for each product.

---

## EPIC F — Tickets Module

### CRM-TIX-001 — Tickets: add Vendor Ticket ID + Vendor Contact lookup; rename fields; auto-set Created By
**Priority:** P1  
**Source:** 2026-01-26  
**Status:** Done

**Description**
Ticket module updates:
- Add fields: **Vendor Ticket ID** (alphanumeric), **Vendor Contact** (contact lookup).
- Rename existing fields: **Ticket ID → House Ticket Number**, **Owner → Created By**.

**Acceptance Criteria**
- Fields exist and appear in list/detail views.
- Vendor Contact is a contact lookup.
- Created By auto-populates on ticket creation.

---

## EPIC G — QA/UAT & Migration

### CRM-QA-001 — Send manual + automated UAT checklists and notes
**Priority:** P1  
**Source:** 2026-01-21  
**Status:** Needs confirmation

**Description**
Send Rob the manual + automated test checklists and notes.

**Acceptance Criteria**
- Checklists delivered to Rob (email or shared doc) and referenced in the shared tracker.

---

### CRM-QA-002 — Run end-to-end reconciliation test with Debra using real files
**Priority:** P0  
**Source:** 2026-01-22  
**Status:** Needs confirmation

**Description**
Run a full end-to-end test (create opps/schedules → upload deposit docs → attempt matching) and capture findings.

**Acceptance Criteria**
- Test run completed.
- Issues found are logged as tickets with reproduction steps.

---

### CRM-MIG-001 — Data migration approach: “Historical Transaction” placeholder product per account
**Priority:** P1  
**Source:** 2026-01-26  
**Status:** Not started

**Description**
Define and implement (or prototype) migration strategy using a placeholder product per account (e.g., “Historical Transaction”) to avoid recreating historical product-level details.

**Acceptance Criteria**
- Migration flow documented and implementable.
- Example import creates the placeholder product + monthly historical schedules per account.
- Users can later correct/adjust start dates as needed.
