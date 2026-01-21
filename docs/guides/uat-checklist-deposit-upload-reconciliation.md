# Manual UAT Checklist - Deposit Upload + Reconciliation

This checklist is keyed to the guide sections:
- `docs/guides/deposit-upload.md`
- `docs/guides/reconciliation.md`

Use it to confirm the user-facing workflows and edge cases without reading code.

---

## How to use this checklist

- Run tests in order (P0 then P1/P2).
- Capture evidence for each item (screenshots, exported CSVs, API responses, and/or DB queries).
- Record IDs you create (depositId, templateId, lineId, scheduleId).

---

## Preconditions / setup

- Accounts + schedules exist for meaningful matching:
  - A customer account with at least 1-2 revenue schedules in the relevant month.
  - Distributor + vendor accounts that will be selected in Deposit Upload.
- Two user roles available:
  - Manager user: has `reconciliation.manage` (and `reconciliation.view`).
  - Viewer user: has `reconciliation.view` only.
- Sample deposit files available (CSV/XLS/XLSX). Repo examples:
  - `Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet1.csv`
  - `Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet2.csv`

---

# Deposit Upload UAT (docs/guides/deposit-upload.md)

## Workflow > 1) Start a new upload

- [ ] **DU-UAT-01 (P0)** Navigate to deposit upload page
  - Steps: Go to `/reconciliation` -> click "Deposit Upload".
  - Expected: You land on `/reconciliation/deposit-upload-list` and see the upload wizard UI.
  - Evidence: Screenshot showing the page + breadcrumb.

## Workflow > 2) Create deposit context (who/when/what)

- [ ] **DU-UAT-02 (P0)** Required fields gate progress
  - Steps: Do not fill any fields; attempt to proceed.
  - Expected: Proceed/continue is disabled until required values are present (deposit received date, commission period, distributor, vendor, file).
  - Evidence: Screenshot showing disabled proceed button.

- [ ] **DU-UAT-03 (P0)** Deposit Name auto-generation
  - Steps: Select vendor + distributor and set deposit received date.
  - Expected: Deposit Name auto-populates as `Vendor - Distributor - YYYY-MM-DD` and updates if you change any of those values.
  - Evidence: Screenshot before/after changing one input.

- [ ] **DU-UAT-04 (P1)** Template selection behavior (optional)
  - Steps: Select distributor + vendor; observe template dropdown/list; pick a template if available.
  - Expected: Template selection is possible but not required to proceed.
  - Evidence: Screenshot showing you can proceed without selecting a template.

## Workflow > 3) Map fields (column-to-field mapping)

- [ ] **DU-UAT-05 (P0)** CSV/Excel parse preview renders
  - Steps: Upload a valid CSV or XLS/XLSX with a header row and at least 1 data row.
  - Expected: Headers and sample rows render in the mapping UI; no parsing error is shown.
  - Evidence: Screenshot of headers + sample rows.

- [ ] **DU-UAT-06 (P0)** Required mappings enforced (usage + commission)
  - Steps: Ensure `usage` and `commission` are unmapped; attempt to continue.
  - Expected: Continue is blocked; UI indicates the required mappings are missing.
  - Evidence: Screenshot of validation indicators and disabled continue.

- [ ] **DU-UAT-07 (P1)** Auto-mapping heuristic provides suggested mappings
  - Steps: Upload a file with common header names (e.g., "usage", "commission"); observe initial mapping state.
  - Expected: Some mappings auto-populate; if headers are unfamiliar, fewer are prefilled.
  - Evidence: Screenshot of prefilled mapping.

- [ ] **DU-UAT-08 (P0)** Undo mapping changes
  - Steps: Change at least 2 mappings; click Undo.
  - Expected: Undo reverts one step at a time; undo is disabled when history is exhausted.
  - Evidence: Screenshot/video or notes showing before/after.

- [ ] **DU-UAT-09 (P1)** "Save mapping updates" toggle presence
  - Steps: Locate the "Save mapping updates..." toggle and change it on/off.
  - Expected: Toggle is present and can be changed.
  - Evidence: Screenshot of toggle state.

## Workflow > 4) Review

- [ ] **DU-UAT-10 (P0)** Review screen reflects mapping + blocks on validation issues
  - Steps: Proceed to Review with missing required mappings; then correct mappings and proceed again.
  - Expected: Review shows validation issues when present; once resolved, it allows proceeding to Confirm.
  - Evidence: Screenshot of review with issues and without issues.

## Workflow > 5) Confirm import

- [ ] **DU-UAT-11 (P0)** Successful import returns a depositId and links to deposit detail
  - Steps: Confirm import with valid required mappings.
  - Expected: Import succeeds; UI shows a link to `/reconciliation/{depositId}`.
  - Evidence: Screenshot of confirm success and the depositId.

## What gets created (server behavior) > Deposit row creation

- [ ] **DU-UAT-12 (P0)** Deposit metadata shows correct name/date/created-by on deposit detail
  - Steps: Open `/reconciliation/{depositId}` after import.
  - Expected: Deposit header shows deposit name, deposit date, and created-by fields consistent with inputs.
  - Evidence: Screenshot of deposit header.

## What gets created (server behavior) > Deposit line ingestion rules

- [ ] **DU-UAT-13 (P1)** Commission-only rows become usage=commission
  - Preconditions: Use a file where at least one row has commission but blank usage.
  - Steps: Import the file; open deposit detail and locate that line.
  - Expected: The line’s usage value matches its commission value.
  - Evidence: Screenshot of the line item values.

- [ ] **DU-UAT-14 (P1)** Line paymentDate falls back to deposit date when not provided
  - Preconditions: Use a file that lacks a mapped per-line payment date column.
  - Steps: Import the file; inspect multiple line items.
  - Expected: Line item payment dates match the deposit date (or the UI displays a consistent fallback).
  - Evidence: Screenshot of line payment dates.

## What gets created (server behavior) > Validation and failure modes

- [ ] **DU-UAT-15 (P0)** Unsupported file types are rejected
  - Steps: Attempt to upload a non-CSV/Excel file (e.g., PDF).
  - Expected: A clear error indicates unsupported file type.
  - Evidence: Screenshot of the error message.

- [ ] **DU-UAT-16 (P1)** Duplicate/ambiguous headers fail clearly
  - Preconditions: A CSV with duplicate header names for a mapped field.
  - Steps: Try to map to the ambiguous header and import.
  - Expected: Import fails with an error indicating the column is ambiguous.
  - Evidence: Screenshot of the error.

## Templates (how they work at a high level)

- [ ] **DU-UAT-17 (P1)** Create and use a template
  - Steps: Create a template from the upload UI (name it); select it; complete an import.
  - Expected: Template is created; selecting it in a new upload session is possible.
  - Evidence: Screenshot showing template created and later selectable.

---

# Reconciliation UAT (docs/guides/reconciliation.md)

## Pages > Deposits list (/reconciliation)

- [ ] **REC-UAT-01 (P0)** Deposits list loads and supports row click -> deposit detail
  - Steps: Visit `/reconciliation`; click a deposit row.
  - Expected: Navigates to `/reconciliation/{depositId}`.
  - Evidence: Screenshot of list + resulting URL.

- [ ] **REC-UAT-02 (P1)** Search and month navigation behave as expected
  - Steps: Change months; search by deposit name/vendor/distributor.
  - Expected: Results change in a reasonable way; empty state is handled.
  - Evidence: Notes/screenshots for one month change + one search.

- [ ] **REC-UAT-03 (P1)** Bulk export CSV works
  - Steps: Select 1+ deposits; run "Export CSV".
  - Expected: CSV downloads and includes expected columns.
  - Evidence: Exported CSV file attached or saved.

- [ ] **REC-UAT-04 (P0)** Delete is blocked for finalized deposits
  - Preconditions: A finalized/reconciled deposit exists.
  - Steps: Attempt to delete it from list bulk delete.
  - Expected: Delete is blocked with a message indicating finalized deposits cannot be deleted.
  - Evidence: Screenshot of block message.

## End-to-end workflow > 2) Match deposit lines to schedules (Deposit Detail)

- [ ] **REC-UAT-05 (P0)** Deposit detail loads metadata + line items
  - Steps: Open `/reconciliation/{depositId}`.
  - Expected: Header shows totals; line items table shows rows.
  - Evidence: Screenshot of header + line items.

- [ ] **REC-UAT-06 (P0)** Selecting a line loads candidate schedules
  - Steps: Select a line item; observe suggested matches table refresh.
  - Expected: Suggested matches appear; empty state is handled if none exist.
  - Evidence: Screenshot with candidates.

- [ ] **REC-UAT-07 (P0)** Apply full match updates line status and totals
  - Preconditions: Candidate schedule exists for a line.
  - Steps: Select 1 line + 1 schedule; click Match.
  - Expected: Line becomes Matched or Partially Matched; allocated/unallocated totals update.
  - Evidence: Screenshot of updated line status and totals.

- [ ] **REC-UAT-08 (P1)** Partial allocations supported (split/merge)
  - Preconditions: A line with enough amount to split or multiple schedules with remaining balance.
  - Steps: Allocate part of usage/commission to schedule A; allocate remainder to schedule B.
  - Expected: Line becomes Matched when fully allocated; multiple schedules show allocated amounts.
  - Evidence: Screenshot of line allocations and schedule allocated fields.

- [ ] **REC-UAT-09 (P0)** Over-allocation is blocked
  - Steps: Attempt to allocate more than remaining unallocated usage/commission.
  - Expected: Server rejects with an error; UI shows an error toast/message.
  - Evidence: Screenshot of the error message.

- [ ] **REC-UAT-10 (P0)** Unmatch removes all allocations for a line
  - Preconditions: Line has at least one applied allocation.
  - Steps: Select the line and run Remove Match/Unmatch.
  - Expected: Line resets to Unmatched; allocations are removed; totals update.
  - Evidence: Screenshot of status reset and totals updated.

- [ ] **REC-UAT-11 (P1)** Delete deposit from deposit detail
  - Preconditions: Deposit is not finalized/reconciled.
  - Steps: Click Delete Deposit in deposit detail and confirm.
  - Expected: Deposit is removed and you return to list; related allocations are removed.
  - Evidence: Screenshot of success + confirmation it is gone from the list.

## End-to-end workflow > 4) Run AI Matching (optional accelerator)

- [ ] **REC-UAT-12 (P1)** AI matching preview loads
  - Steps: From deposit detail, click "Use AI Matching".
  - Expected: AI matching page loads and shows preview counts and candidate rows if present.
  - Evidence: Screenshot of preview summary.

- [ ] **REC-UAT-13 (P1)** Apply allocations updates the deposit
  - Preconditions: At least one line qualifies (confidence >= auto threshold).
  - Steps: Click "Apply allocations"; return to deposit detail.
  - Expected: Some lines are now allocated; totals update; success messaging appears.
  - Evidence: Screenshot before/after.

## End-to-end workflow > 5) Finalize (lock) or reopen (unlock)

- [ ] **REC-UAT-14 (P0)** Finalize blocked when Unmatched or Suggested lines exist
  - Steps: Ensure at least one line is Unmatched (or has a pending chargeback Suggested state); attempt finalize.
  - Expected: Finalize fails with an error indicating unreconciled lines remain.
  - Evidence: Screenshot of the error.

- [ ] **REC-UAT-15 (P0)** Finalize locks editing; reopen unlocks
  - Preconditions: A deposit with no Unmatched/Suggested lines (all matched/ignored as applicable).
  - Steps: Finalize; then attempt to change allocations (should be blocked); then Reopen and confirm edits are possible again.
  - Expected: Finalize sets deposit to locked state; reopen restores editability.
  - Evidence: Screenshots of finalized status + reopened status.

## Flex Review Queue (/reconciliation/flex-review)

- [ ] **FLEX-UAT-01 (P1)** Queue loads and filters work
  - Steps: Visit `/reconciliation/flex-review`; try filters (status, assignment, age, min amount).
  - Expected: Results filter; loading and empty states are handled.
  - Evidence: Screenshot of filtered list.

- [ ] **FLEX-UAT-02 (P1)** Assign to me / unassign works
  - Steps: Assign an item to yourself; unassign it.
  - Expected: Assignment updates and persists after refresh.
  - Evidence: Screenshot before/after.

- [ ] **FLEX-UAT-03 (P1)** Approve & Apply updates the source deposit
  - Preconditions: Have a pending chargeback / CB-reversal flex review item.
  - Steps: Click Approve & Apply; open the referenced deposit and line.
  - Expected: Pending allocation becomes applied and deposit totals reflect the change.
  - Evidence: Screenshot of the deposit line status/totals post-approval.

