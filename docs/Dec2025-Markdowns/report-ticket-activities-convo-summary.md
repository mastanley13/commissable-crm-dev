Short answer: those behaviors are not fully implemented yet. Right now:

Reports/Tickets/Activities all show the standardized bulk-action header with Delete / Reassign / Update Status / Export.
However, for Reports only, bulk Delete actually updates the client-side list; for Tickets/Activities all four bulk handlers are still stubs (they log + toast and don’t change data).
None of the three pages currently:
Restrict Delete to inactive rows only.
Show a confirmation dialog before delete.
Open a Change Owner modal on “Reassign Owner”.
Open an Active/Inactive modal on “Update Status”.
To get them to the same depth as Accounts/Contacts/Opportunities/Products we need to:

1) Delete only inactive + confirm

Per page:

Introduce or leverage an active flag on each row type:
Tickets: TicketRow already has active: boolean.
Activities: ActivityRow has active: boolean.
Reports: add active: boolean to ReportRow and set it from the in-memory data (e.g., default true; toggled by the status bulk action).
In each handleBulkDelete:
Compute const inactiveIds = selectedIds.filter(id => !rowMap[id].active).
If inactiveIds.length === 0, show a toast like “Only inactive items can be deleted” and return.
Show a confirm UI (either window.confirm(...) or reusing TwoStageDeleteDialog if you want parity with Accounts).
On confirm, remove only the inactive rows from local state and update pagination; leave active rows selected/untouched.

2) Change Owner modal wired to the bulk “Reassign Owner” button

Create a generic owner modal component (copy the existing GroupBulkOwnerModal, but rename it and make the copy text generic—e.g., “Change Owner” / “selected items” instead of “groups”).
On Reports/Tickets/Activities list pages:
Add showOwnerModal + ownerOptions + ownerLoading state.
On Reassign click:
If no selection: toast and return.
Set showOwnerModal=true, fetch owners from /api/admin/users?status=Active&limit=200, and populate ownerOptions with { value: id, label: fullName }.
In onSubmit(ownerId) from the modal:
For Tickets/Activities: update the appropriate local field (ownerName or assigneeName) on selected rows; toast success and close.
For Reports: either add an ownerName field and update locally, or wire to a future /api/reports/[id] PATCH if you introduce owners later.

3) Active/Inactive modal wired to the “Update Status” button

Create a generic status modal (copy GroupBulkStatusModal and rename it; label controls “Mark as Active/Inactive” but avoid hard-coded “groups” text).
On each page:
Add showStatusModal + statusSubmitting state.
On Update Status click:
If no selection: toast and return.
Show the modal.
On modal submit (isActive: boolean):
Update the active flag on all selected rows, and for Reports optionally derive a display status (active ? 'Completed' : 'Inactive' or similar).
Clear selection, toast success, and close the modal.
Once those three pieces are in place per page, the behavior of bulk Delete/Reassign/Status/Export on Reports/Tickets/Activities will match the depth of the completed tables: Delete respects inactive-only + confirmation, owner/status actions use real modals, and Export produces a CSV based on the selection just as we’ve already done for Groups and Accounts-style pages.