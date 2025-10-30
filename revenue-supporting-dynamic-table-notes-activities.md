Here’s a focused plan to bring the Revenue Schedule “Activities & Notes” to parity with the Accounts Activities tab, including gaps and concrete actions.

What We Have Today

components/revenue-schedule-supporting-details.tsx:441 renders a static table under renderActivitiesNotes with no dynamic-table, search, filters, selection, bulk actions, or preferences.
components/account-details-view.tsx has a full-featured Activities tab:
DynamicTable with column resizing/reordering/hide-show and preferences
ListHeader with search, “Filter by Column”, Active/Inactive toggle
Column chooser modal with saved preferences via useTablePreferences
Row selection + bulk action bar (delete, export CSV, change owner, update status)
Create and Edit Activity modals
Pagination integrated with the table
Key References

Revenue schedule details view component: components/revenue-schedule-supporting-details.tsx:123
Static activities area to replace: components/revenue-schedule-supporting-details.tsx:441
Accounts Activities base columns: components/account-details-view.tsx:664 (const ACTIVITY_TABLE_BASE_COLUMNS)
Accounts Activities tab block (for behavior/UX match): components/account-details-view.tsx:4558
Table preferences usage (pattern to follow): components/account-details-view.tsx:1937 (useTablePreferences("account-details:activities", ...))
Dynamic table engine: components/dynamic-table.tsx
List header (search/filters): components/list-header.tsx
Activity modals and bulk actions:
Create: components/activity-note-create-modal.tsx
Edit: components/activity-note-edit-modal.tsx
Bulk Action Bar: components/activity-bulk-action-bar.tsx
Bulk Owner: components/activity-bulk-owner-modal.tsx
Bulk Status: components/activity-bulk-status-modal.tsx
Gaps To Close

No dynamic table; static markup only.
No search, column-filter, or active/inactive toggle behavior wired.
No column chooser or saved preferences.
No row selection or bulk actions.
No data loading; schedule detail shape has no activities array.
Create/Edit modals lack revenue schedule context; Create modal does not accept revenueScheduleId.
No pagination or page size control tied to data loading.
Implementation Plan

Columns and Preferences
Add schedule-specific base columns, closely mirroring Accounts Activities:
Columns: multi-action (select all), activityDate, activityType, description, fileName, createdBy, optionally revenueScheduleNumber (instead of accountName) if desired.
Create filterable column options: activityDate, activityType, description, createdBy, fileName, and optionally revenueScheduleNumber.
Use useTablePreferences("revenue-schedule:activities", BASE_COLUMNS) to persist widths/order/visibility like accounts.
Data Loading (server-backed)
Fetch from /api/activities using Revenue Schedule context:
contextType=RevenueSchedule, contextId=schedule.id, page, pageSize, search, includeCompleted (for Show All), and sorting defaults to match Accounts.
Store and manage activities, pagination, loading, error.
Wire ListHeader search to refresh query; apply per-column filters client-side with applySimpleFilters on the loaded page (note: server-wide column filters would need API support; call this out as a limitation if not implemented now).
Table + ListHeader Integration
Replace static renderActivitiesNotes with:
ListHeader configured to:
Search Activities
Active/Show Inactive toggle mapped to includeCompleted param
Filter By Column (client-side on fetched page)
Settings button opening ColumnChooserModal
“Create New” button
ActivityBulkActionBar shown when selections > 0
DynamicTable configured with:
columns (from preferences), data (page data)
onColumnsChange into useTablePreferences
row selection (selectedIds, onItemSelect, onSelectAll)
pagination handlers
autoSizeColumns, fillContainerWidth, maxBodyHeight, alwaysShowPagination
row click → open edit modal
Modals: Create/Edit Support for Revenue Schedules
Extend ActivityNoteCreateModal to support “revenue-schedule” context:
Props: context: "revenue-schedule", revenueScheduleId, entityName (e.g., schedule number/name)
Update header copy accordingly
Include revenueScheduleId in POST payload (API already supports it)
Extend ActivityNoteEditModal to accept revenueScheduleId?: string | null and include it in PATCH payload when provided.
Wire modals in revenue-schedule-supporting-details.tsx:
Create: isOpen state, pass context="revenue-schedule", revenueScheduleId=schedule.id, entityName=schedule.revenueScheduleName || schedule.revenueSchedule
Edit: opens with selected row id
Bulk Actions
Change Owner: PATCH /api/activities/{id} with { assigneeId } for all selected.
Update Status: PATCH /api/activities/{id} with { status } for all selected.
Export CSV: Build from selected rows like Accounts Activities export.
Delete strategy:
If “Delete” should mark inactive instead of hard delete, wire to PATCH status to a completed/closed state; otherwise add a TwoStageDeleteDialog for Activities if permanent deletion is desired. Confirm desired behavior.
UX Parity Details
Match Accounts look/feel:
ListHeader placement and copy
Pagination controls in DynamicTable footer
Selection behavior and visual highlighting
ColumnChooserModal for activities with saved feedback (unsaved warning, save state)
Use similar tableBodyMaxHeight to avoid browser perf issues with tall tables.
Permissions and Safety
Gate Create/Edit/Bulk actions on appropriate permissions (e.g., activities.manage).
Handle loading/empty/error states.
Keys, State, and Cleanup
State keys:
preferences key: revenue-schedule:activities
pagination: activitiesPage, activitiesPageSize
filters: activitiesSearchQuery, activitiesColumnFilters, activeFilter
selection: selectedActivityIds
Debounce search 150–300ms before refetch.
Testing/Validation
Manual validation:
Search, toggle Active/Show All, column filter, select rows, export CSV, change owner, update status, edit row
Preferences persist across refresh
Create an activity tied to this schedule; verify it lists
Optional: add a lightweight integration test where applicable.
Concrete Changes By File

components/revenue-schedule-supporting-details.tsx:441
Replace static table in renderActivitiesNotes with ListHeader, BulkActionBar, DynamicTable, ColumnChooserModal, Create/Edit modals, and state/effects for fetching and managing activities.
Add new constants: RS_ACTIVITY_TABLE_BASE_COLUMNS, rsActivitiesFilterColumns.
Add state and handlers: search, filters, selection, pagination, bulk actions, open/close modals.
components/activity-note-create-modal.tsx
Add context: "revenue-schedule" and revenueScheduleId?: string props.
When context is “revenue-schedule”, set header and include revenueScheduleId in POST payload.
components/activity-note-edit-modal.tsx
Accept revenueScheduleId?: string | null.
Include it in PATCH payload when present (keeps relationships correct on updates).
(Optional) components/dynamic-table.tsx
No change anticipated; reuse as-is.
(Optional) components/list-header.tsx
No change anticipated; reuse as-is.
Open Questions / Assumptions

Delete behavior: match Accounts (soft delete) or mark activities as Completed/Closed? If permanent delete is allowed, we’ll add a TwoStageDeleteDialog flow similar to Contacts/Groups.
Columns: replace Account Name with Schedule # or include revenueScheduleNumber alongside; confirm expected columns for revenue schedule view.
Server-side column filtering isn’t supported by /api/activities today; we’ll apply “Filter By Column” client‑side to the current page unless we enhance the API.
If you want, I can proceed to implement the changes starting with wiring up the ListHeader, DynamicTable, and GET /api/activities on the revenue schedule page, then extend the modals for revenue-schedule context.

