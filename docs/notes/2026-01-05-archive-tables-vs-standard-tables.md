# Archive Tables vs Standard Tables ΓÇö Feature Gap Review (2026-01-05)

This document compares each **Admin ΓåÆ Archive** table against its corresponding ΓÇ£standardΓÇ¥ module list table in the app and calls out **missing features / parity gaps** in the archive UX.

Scope: `app/(dashboard)/admin/archive/*/page.tsx` compared to `app/(dashboard)/*/page.tsx`.

---

## What ΓÇ£standard tablesΓÇ¥ typically support (observed)

Across most module list pages, the ΓÇ£standardΓÇ¥ list/table experience includes:

- **Working sort** (server-side and/or client-side) via `DynamicTable` + `onSort`.
- **Column filters UI** via `ListHeader` (`filterColumns`, `columnFilters`, `onColumnFiltersChange`).
- **Status filters / quick filters** (Active/Inactive/All, plus module-specific quick filters).
- **Column settings** / column chooser via `ColumnChooserModal` + persisted preferences (visible columns, order, widths, page size).
- **Bulk actions** beyond restore/delete (reassign owner, status updates, export CSV, etc.; varies by module).
- **Row navigation** (often via `onRowClick`, sometimes via link-rendered columns).

Archive pages generally provide:

- Search
- Pagination + page size
- Selection + basic bulk actions (restore + permanent delete)

---

## Cross-cutting gaps present in most archive tables

### 1) Sorting is effectively non-functional in archive tables

Previously, archive pages marked many columns as `sortable: true`, but did **not** pass `onSort` to `DynamicTable`.

`DynamicTable` only toggles the sort indicator unless `onSort` is provided (it does not sort `data` itself), so archive tables showed ƒ?osortable headersƒ?? but the dataset did not change.

Status: **Resolved** across all Admin Archive pages (each archive list now wires `onSort` and forwards sort params to the relevant API route).

### 2) Column filters are disabled across archive pages

Previously, most archive headers explicitly disabled column filters (`showColumnFilters={false}`), so the standard “Filter By Column” UI was missing.

Status: **Resolved** across all Admin Archive pages (column filters UI enabled and forwarded to the relevant API route).

### 3) Column settings / saved preferences are missing in archive pages

Standard lists commonly expose column settings (`onSettingsClick` ΓåÆ `ColumnChooserModal`) and persist table layout preferences. Archive pages do not:

- no settings button
- no `ColumnChooserModal`
- no preference persistence hooks
- Status: **Resolved** across all Admin Archive pages (column chooser + persisted preferences now included).
- no `onColumnsChange` passed into `DynamicTable` (so even drag/resize changes canΓÇÖt be saved upstream)

### 4) Export / richer bulk actions are missing

Standard list pages often provide export (implemented or queued) and non-destructive bulk actions (reassign, status). Archive pages generally only provide:

- Restore/Reopen
- Permanent delete

### 5) Inconsistent ΓÇ£archive metadataΓÇ¥ columns

Some archive tables show an ΓÇ£Archived OnΓÇ¥ column (sometimes `deletedAt`, sometimes `updatedAt`), while others show a different timestamp (or none at all). There is no consistent **Archived On / Archived By / Archive Reason** metadata surfaced.

---

## Entity-by-entity comparisons

### Accounts

- Main list: `app/(dashboard)/accounts/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/accounts/page.tsx`

Missing features in archive (vs main):

- **Working sort** (`DynamicTable` has no `onSort`).
- **Status filter + column filters** (archive sets `showStatusFilter={false}`, `showColumnFilters={false}`).
- **Column settings + saved preferences** (no `onSettingsClick`, no `ColumnChooserModal`, no persisted table config).
- **Bulk actions parity** (no export, no bulk owner/status tools).

Column parity notes:

- Archive list shows a small subset (Account Name, Type, Legal Name, Owner, ΓÇ£Archived OnΓÇ¥).
- Main list supports many additional standardized fields (account number, active/inactive, parent account, industry, website, addresses, description, etc.) and supports choosing columns.

Archive metadata note:

- Accounts archive uses `updatedAt` labeled ΓÇ£Archived OnΓÇ¥ (`app/(dashboard)/admin/archive/accounts/page.tsx`).

#### Archived Accounts parity features added (implemented)

Archived Accounts has been upgraded to match the ΓÇ£standard tableΓÇ¥ UX in these areas:

- **Working sort (server-side)**: `DynamicTable` `onSort` wired and forwarded to `/api/accounts` via `sortBy`/`sortDir` (`app/(dashboard)/admin/archive/accounts/page.tsx` + `app/api/accounts/route.ts`).
- **Column filters UI (server-side)**: `ListHeader` column filters enabled and forwarded to `/api/accounts` via `filters` JSON (`app/(dashboard)/admin/archive/accounts/page.tsx` + `app/api/accounts/route.ts`).
- **Status / quick filter**: quick dropdown added for `Archived` / `Inactive` / `All` (maps to `status=archived`, `status=inactive`, or `includeArchived=true`) (`app/(dashboard)/admin/archive/accounts/page.tsx`).
- **Column settings + persisted preferences**: `ColumnChooserModal` + `useTablePreferences('accounts:archive', ΓÇª)` for column order, widths, hidden columns, and page size (`app/(dashboard)/admin/archive/accounts/page.tsx`).
- **Drag reorder + resize**: column drag reorder and resize are enabled and persisted (including the `Select All` column) (`components/dynamic-table.tsx`, `app/globals.css`, `app/(dashboard)/admin/archive/accounts/page.tsx`).
- **Bulk actions**: `Restore`, `Export CSV`, and `Delete Permanently` are available as standard bulk actions (`app/(dashboard)/admin/archive/accounts/page.tsx`).
- **Row navigation**: row click navigates to the Account details page (`/accounts/[accountId]`) (`app/(dashboard)/admin/archive/accounts/page.tsx`).
- **Row-level actions**: Restore + Delete moved into the selection column as icon buttons (green `RotateCcw` for restore, red `Trash2` for delete) (`app/(dashboard)/admin/archive/accounts/page.tsx`).

---

### Contacts

- Main list: `app/(dashboard)/contacts/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/contacts/page.tsx`

Remaining differences in archive (vs main):

- Main Contacts includes additional module-specific bulk actions (owner reassignment, status updates, deactivate), plus create/edit flows; archive page currently focuses on archive workflows.

Column parity notes:

- Archive list includes a small subset (Name, Job Title, Account, Email, Owner, Archived On).
- Main list includes many additional standardized fields (phones, contact type, active, decision maker, preferred contact method, etc.) and column chooser support.

Archive metadata note:

- Contacts archive uses `deletedAt` labeled ΓÇ£Archived OnΓÇ¥ (`app/(dashboard)/admin/archive/contacts/page.tsx`).

#### Archived Contacts parity features added (implemented)

Archived Contacts has been upgraded to match the ΓÇ£standard tableΓÇ¥ UX in these areas:

- **Working sort (server-side)**: `DynamicTable` `onSort` wired and forwarded to `/api/contacts` via `sortBy`/`sortDir` (`app/(dashboard)/admin/archive/contacts/page.tsx` + `app/api/contacts/route.ts`).
- **Column filters UI (server-side)**: `ListHeader` column filters enabled and forwarded to `/api/contacts` via `columnFilters` JSON (`app/(dashboard)/admin/archive/contacts/page.tsx` + `app/api/contacts/route.ts`).
- **Status / quick filter**: quick dropdown added for `Archived` / `Active` / `All` (maps to `includeDeleted=true&deletedOnly=true`, default active-only, or `includeDeleted=true`) (`app/(dashboard)/admin/archive/contacts/page.tsx`).
- **Column settings + persisted preferences**: `ColumnChooserModal` + `useTablePreferences('contacts:archive', ΓÇª)` for column order, widths, hidden columns, and page size (`app/(dashboard)/admin/archive/contacts/page.tsx`).
- **Drag reorder + resize**: column drag reorder and resize are enabled and persisted (`app/(dashboard)/admin/archive/contacts/page.tsx`, `components/dynamic-table.tsx`, `app/globals.css`).
- **Bulk actions**: `Restore`, `Export CSV`, and `Delete Permanently` are available as standard bulk actions (`app/(dashboard)/admin/archive/contacts/page.tsx`).
- **Row navigation**: row click navigates to the Contact details page (`/contacts/[contactId]`) (`app/(dashboard)/admin/archive/contacts/page.tsx`).
- **Row-level actions**: Restore + Delete moved into the selection column as icon buttons (green `RotateCcw` for restore, red `Trash2` for delete) (`app/(dashboard)/admin/archive/contacts/page.tsx`).

---

### Opportunities

- Main list: `app/(dashboard)/opportunities/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/opportunities/page.tsx`

Remaining differences in archive (vs main):

- Main Opportunities includes additional module-specific bulk actions (owner reassignment, status updates, deactivate) and edit flows; archive page focuses on archive workflows.

Column parity notes:

- Archive list shows only a small subset (Opportunity, Account, Owner, Stage, Status, Close Date).
- Main list supports a significantly wider set of columns (IDs, addresses, splits, distributor/vendor info, expected totals, etc.) and column chooser support.

Archive metadata note:

- Opportunities archive does not show a dedicated ΓÇ£Archived OnΓÇ¥ timestamp (only ΓÇ£Close DateΓÇ¥).

#### Archived Opportunities parity features added (implemented)

Archived Opportunities has been upgraded to match the ΓÇ£standard tableΓÇ¥ UX in these areas:

- **Working sort (server-side)**: `DynamicTable` `onSort` wired and forwarded to `/api/opportunities` via `sort`/`direction` (`app/(dashboard)/admin/archive/opportunities/page.tsx` + `app/api/opportunities/route.ts`).
- **Column filters UI (server-side)**: `ListHeader` column filters enabled and forwarded to `/api/opportunities` via `filters` JSON (`app/(dashboard)/admin/archive/opportunities/page.tsx` + `app/api/opportunities/route.ts`).
- **Status / quick filter**: quick dropdown added for `Archived` / `All` (maps to `status=inactive` or `status=all`) (`app/(dashboard)/admin/archive/opportunities/page.tsx`).
- **Column settings + persisted preferences**: `ColumnChooserModal` + `useTablePreferences('opportunities:archive', ΓÇª)` for column order, widths, hidden columns, and page size (`app/(dashboard)/admin/archive/opportunities/page.tsx`).
- **Drag reorder + resize**: column drag reorder and resize are enabled and persisted (`app/(dashboard)/admin/archive/opportunities/page.tsx`, `components/dynamic-table.tsx`, `app/globals.css`).
- **Bulk actions**: `Restore`, `Export CSV`, and `Delete Permanently` are available as standard bulk actions (`app/(dashboard)/admin/archive/opportunities/page.tsx`).
- **Row navigation**: row click navigates to the Opportunity details page (`/opportunities/[opportunityId]`) (`app/(dashboard)/admin/archive/opportunities/page.tsx`).
- **Row-level actions**: Restore + Delete moved into the selection column as icon buttons (green `RotateCcw` for restore, red `Trash2` for delete) (`app/(dashboard)/admin/archive/opportunities/page.tsx`).

---

### Revenue Schedules

- Main list: `app/(dashboard)/revenue-schedules/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/revenue-schedules/page.tsx`

Remaining differences in archive (vs main):

- Main Revenue Schedules includes additional module-specific workflows (date range + quick status filters, bulk apply, status management, clone); archive page focuses on archive workflows.

Column parity notes:

- Archive list shows a minimal subset (Schedule name/date, Account, Distributor, Vendor, Product, Status, Archived On).
- Main list includes extensive computed/financial columns (usage/commission nets, balances, differences, IDs, etc.) plus filter and date-range UX.

Archive metadata note:

- Revenue schedules archive uses `deletedAt` as ΓÇ£Archived OnΓÇ¥ (`app/(dashboard)/admin/archive/revenue-schedules/page.tsx`).

#### Archived Revenue Schedules parity features added (implemented)

Archived Revenue Schedules has been upgraded to match the ΓÇ£standard tableΓÇ¥ UX in these areas:

- **Working sort (server-side)**: `DynamicTable` `onSort` wired and forwarded to `/api/revenue-schedules` via `sort`/`direction` (`app/(dashboard)/admin/archive/revenue-schedules/page.tsx` + `app/api/revenue-schedules/route.ts`).
- **Column filters UI (server-side)**: `ListHeader` column filters enabled and forwarded to `/api/revenue-schedules` via `filters` JSON (`app/(dashboard)/admin/archive/revenue-schedules/page.tsx` + `app/api/revenue-schedules/route.ts`).
- **Status / quick filter**: quick dropdown added for `Archived` / `All` (maps to `includeDeleted=true&deletedOnly=true` or `includeDeleted=true`) (`app/(dashboard)/admin/archive/revenue-schedules/page.tsx`).
- **Column settings + persisted preferences**: `ColumnChooserModal` + `useTablePreferences('revenue-schedules:archive', ΓÇª)` for column order, widths, hidden columns, and page size (`app/(dashboard)/admin/archive/revenue-schedules/page.tsx`).
- **Drag reorder + resize**: column drag reorder and resize are enabled and persisted (`app/(dashboard)/admin/archive/revenue-schedules/page.tsx`, `components/dynamic-table.tsx`, `app/globals.css`).
- **Bulk actions**: `Restore`, `Export CSV`, and `Delete Permanently` are available as standard bulk actions (`app/(dashboard)/admin/archive/revenue-schedules/page.tsx`).
- **Row navigation**: row click navigates to the Revenue Schedule details page (`/revenue-schedules/[revenueScheduleId]`) (`app/(dashboard)/admin/archive/revenue-schedules/page.tsx`).
- **Row-level actions**: Restore + Delete moved into the selection column as icon buttons (green `RotateCcw` for restore, red `Trash2` for delete) (`app/(dashboard)/admin/archive/revenue-schedules/page.tsx`).

---

### Products (Catalog)

- Main list: `app/(dashboard)/products/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/products/page.tsx`

Remaining differences in archive (vs main):

- Main Catalog includes additional module-specific workflows (create + edit flows, active status toggles, richer columns); archive page focuses on archive workflows.
- Restore is Admin-only (the API enforces this), so non-admins can still view but cannot restore.

Column parity notes:

- Archive list shows a subset (house/vendor names, part #, distributor/vendor, revenue type, has schedules).
- Archive list does **not** show an ΓÇ£Archived OnΓÇ¥ timestamp column.

#### Archived Products parity features added (implemented)

Archived Products has been upgraded to match the ΓÇ£standard tableΓÇ¥ UX in these areas:

- **Working sort (server-side)**: `DynamicTable` `onSort` wired and forwarded to `/api/products` via `sort`/`direction` (`app/(dashboard)/admin/archive/products/page.tsx` + `app/api/products/route.ts`).
- **Column filters UI (server-side)**: `ListHeader` column filters enabled and forwarded to `/api/products` via `filters` JSON (`app/(dashboard)/admin/archive/products/page.tsx` + `app/api/products/route.ts`).
- **Status / quick filter**: quick dropdown added for `Archived` / `Active` / `All` (maps to `status=inactive`, `status=active`, or `status=all`) (`app/(dashboard)/admin/archive/products/page.tsx`).
- **Column settings + persisted preferences**: `ColumnChooserModal` + `useTablePreferences('products:archive', ΓÇª)` for column order, widths, hidden columns, and page size (`app/(dashboard)/admin/archive/products/page.tsx`).
- **Drag reorder + resize**: column drag reorder and resize are enabled and persisted (`app/(dashboard)/admin/archive/products/page.tsx`, `components/dynamic-table.tsx`, `app/globals.css`).
- **Bulk actions**: `Restore`, `Export CSV`, and `Delete Permanently` are available as standard bulk actions (`app/(dashboard)/admin/archive/products/page.tsx`).
- **Row navigation**: row click navigates to the Product details page (`/products/[productId]`) (`app/(dashboard)/admin/archive/products/page.tsx`).
- **Row-level actions**: Restore + Delete moved into the selection column as icon buttons (green `RotateCcw` for restore, red `Trash2` for delete) (`app/(dashboard)/admin/archive/products/page.tsx`).

---

### Groups

- Main list: `app/(dashboard)/groups/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/groups/page.tsx`

#### Archived Groups parity features added (implemented)

Archived Groups has been upgraded to match the ƒ?ostandard tableƒ?? UX in these areas:

- **Working sort (server-side)**: `DynamicTable` `onSort` wired and forwarded to `/api/groups` via `sortBy`/`sortDir` (`app/(dashboard)/admin/archive/groups/page.tsx`).
- **Column filters UI (server-side)**: `ListHeader` column filters enabled and forwarded to `/api/groups` via `columnFilters` JSON (`app/(dashboard)/admin/archive/groups/page.tsx`).
- **Status / quick filter**: quick dropdown added for `Archived` / `Active` / `All` (maps to `status=inactive`, `status=active`, or `status=all`) (`app/(dashboard)/admin/archive/groups/page.tsx`).
- **Column settings + persisted preferences**: `ColumnChooserModal` + `useTablePreferences('groups:archive', …)` for column order, widths, hidden columns, and page size (`app/(dashboard)/admin/archive/groups/page.tsx`).
- **Drag reorder + resize**: column drag reorder and resize are enabled and persisted (`app/(dashboard)/admin/archive/groups/page.tsx`, `components/dynamic-table.tsx`, `app/globals.css`).
- **Bulk actions**: `Restore`, `Export CSV`, and `Delete Permanently` are available as standard bulk actions (`app/(dashboard)/admin/archive/groups/page.tsx`).
- **Row navigation**: row click navigates to the Group details page (`/groups/[groupId]`) (`app/(dashboard)/admin/archive/groups/page.tsx`).
- **Row-level actions**: Restore + Delete moved into the selection column as icon buttons (green `RotateCcw` for restore, red `Trash2` for delete) (`app/(dashboard)/admin/archive/groups/page.tsx`).

---

### Tickets

- Main list: `app/(dashboard)/tickets/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/tickets/page.tsx`

#### Archived Tickets parity features added (implemented)

Archived Tickets has been upgraded to match the ƒ?ostandard tableƒ?? UX in these areas:

- **Working sort (server-side)**: `DynamicTable` `onSort` wired and forwarded to `/api/tickets` via `sortBy`/`sortDir` (`app/(dashboard)/admin/archive/tickets/page.tsx`).
- **Column filters UI (server-side)**: `ListHeader` column filters enabled and forwarded to `/api/tickets` via `columnFilters` JSON (`app/(dashboard)/admin/archive/tickets/page.tsx`).
- **Status / quick filter**: quick dropdown added for `Archived` / `Active` / `All` (maps to `status=inactive`, `status=active`, or `status=all`) (`app/(dashboard)/admin/archive/tickets/page.tsx`).
- **Column settings + persisted preferences**: `ColumnChooserModal` + `useTablePreferences('tickets:archive', …)` for column order, widths, hidden columns, and page size (`app/(dashboard)/admin/archive/tickets/page.tsx`).
- **Drag reorder + resize**: column drag reorder and resize are enabled and persisted (`app/(dashboard)/admin/archive/tickets/page.tsx`, `components/dynamic-table.tsx`, `app/globals.css`).
- **Bulk actions**: `Reopen`, `Export CSV`, and `Delete Permanently` are available as standard bulk actions (`app/(dashboard)/admin/archive/tickets/page.tsx`).
- **Row navigation**: row click navigates to the Ticket details page (`/tickets/[ticketId]`) (`app/(dashboard)/admin/archive/tickets/page.tsx`).
- **Row-level actions**: Reopen + Delete moved into the selection column as icon buttons (green `RotateCcw` for reopen, red `Trash2` for delete) (`app/(dashboard)/admin/archive/tickets/page.tsx`).

---

### Activities

- Main list: `app/(dashboard)/activities/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/activities/page.tsx`

#### Archived Activities parity features added (implemented)

Archived Activities has been upgraded to match the ƒ?ostandard tableƒ?? UX in these areas:

- **Working sort (server-side)**: `DynamicTable` `onSort` wired and forwarded to `/api/activities` via `sortBy`/`sortDirection` (`app/(dashboard)/admin/archive/activities/page.tsx` + `app/api/activities/route.ts`).
- **Column filters UI (server-side)**: `ListHeader` column filters enabled and forwarded to `/api/activities` via `columnFilters` JSON (`app/(dashboard)/admin/archive/activities/page.tsx` + `app/api/activities/route.ts`).
- **Status / quick filter**: quick dropdown added for `Completed` / `Open` / `All` (maps to `includeCompleted=true&status=Completed`, `includeCompleted=false`, or `includeCompleted=true`) (`app/(dashboard)/admin/archive/activities/page.tsx`).
- **Column settings + persisted preferences**: `ColumnChooserModal` + `useTablePreferences('activities:archive', …)` for column order, widths, hidden columns, and page size (`app/(dashboard)/admin/archive/activities/page.tsx`).
- **Drag reorder + resize**: column drag reorder and resize are enabled and persisted (`app/(dashboard)/admin/archive/activities/page.tsx`, `components/dynamic-table.tsx`, `app/globals.css`).
- **Bulk actions**: `Reopen`, `Export CSV`, and `Delete Permanently` are available as standard bulk actions (`app/(dashboard)/admin/archive/activities/page.tsx`).
- **Row navigation**: row click navigates to the Activity details page (`/activities/[activityId]`) (`app/(dashboard)/admin/archive/activities/page.tsx`).
- **Row-level actions**: Reopen + Delete moved into the selection column as icon buttons (green `RotateCcw` for reopen, red `Trash2` for delete) (`app/(dashboard)/admin/archive/activities/page.tsx`).

---

### Reports

- Main list: `app/(dashboard)/reports/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/reports/page.tsx`

#### Archived Reports parity features added (implemented)

Archived Reports has been upgraded to match the ƒ?ostandard tableƒ?? UX in these areas:

- **Archive listing implemented**: archive reports now render as a real table backed by the Reports API (`app/(dashboard)/admin/archive/reports/page.tsx`).
- **Working sort (server-side)**: `DynamicTable` `onSort` wired and forwarded to `/api/reports` via `sortBy`/`sortDir` (`app/(dashboard)/admin/archive/reports/page.tsx` + `app/api/reports/route.ts`).
- **Column filters UI (server-side)**: `ListHeader` column filters enabled and forwarded to `/api/reports` via `columnFilters` JSON (`app/(dashboard)/admin/archive/reports/page.tsx` + `app/api/reports/route.ts`).
- **Status / quick filter**: quick dropdown added for `Archived` / `Active` / `All` (maps to `recordStatus=inactive`, `recordStatus=active`, or `recordStatus=all`) (`app/(dashboard)/admin/archive/reports/page.tsx` + `app/api/reports/route.ts`).
- **Column settings + persisted preferences**: `ColumnChooserModal` + `useTablePreferences('reports:archive', …)` for column order, widths, hidden columns, and page size (`app/(dashboard)/admin/archive/reports/page.tsx`).
- **Drag reorder + resize**: column drag reorder and resize are enabled and persisted (`app/(dashboard)/admin/archive/reports/page.tsx`, `components/dynamic-table.tsx`, `app/globals.css`).
- **Bulk actions**: `Restore`, `Export CSV`, and `Delete Permanently` are available as standard bulk actions (`app/(dashboard)/admin/archive/reports/page.tsx`).
- **Row navigation**: row click navigates to a Report details page (`/reports/[reportId]`) (`app/(dashboard)/admin/archive/reports/page.tsx`, `app/(dashboard)/reports/[reportId]/page.tsx`).
- **Row-level actions**: Restore + Delete moved into the selection column as icon buttons (green `RotateCcw` for restore, red `Trash2` for delete) (`app/(dashboard)/admin/archive/reports/page.tsx`).

---

## Suggested standardization targets (high-value)

If archive tables are intended to behave like standard list tables, the biggest gaps to close are:

1. Add **working sort** for archive pages (either client-side sort or pass `onSort` + include sort params in API requests).
2. Enable **column filters** in `ListHeader` and forward filter state into archive fetches.
3. Add **column settings + persisted preferences** (reuse the same table preferences approach used in main lists).
4. Add **consistent archive metadata** columns across all archive tables (Archived On, Archived By, Archive Reason where available).

---

## Phased Plan to Close Archive Table Gaps

Status: As of 2026-01-05, the parity checklist items in this plan have been implemented across all Admin Archive pages.

This plan is designed to ship improvements safely, in small increments, while reusing the ΓÇ£standard list pageΓÇ¥ patterns already present in the app.

### Phase 0 ΓÇö Alignment + Inventory (0.5ΓÇô1 day)

- Decide per entity whether archive lists should be **server-sorted** (recommended for consistency with pagination) vs **client-sorted** (quick win but misleading with pagination).
- Confirm what ΓÇ£ArchiveΓÇ¥ means per entity:
  - soft-delete via `deletedAt` (Accounts/Contacts/Revenue Schedules)
  - inactive via `active=false` or status field (Opportunities/Groups/Tickets/Activities/Products)
- Identify the canonical ΓÇ£Archived OnΓÇ¥ field per entity (and whether ΓÇ£Archived ByΓÇ¥ / ΓÇ£Archive ReasonΓÇ¥ exists in the DB/audits).
- Create a parity checklist (same set of UX capabilities across all archive pages).

Deliverable: a short decision doc + checklist used for all phases below.

### Phase 1 ΓÇö Fix Sorting (highest-impact, low risk) (1ΓÇô2 days)

Goal: eliminate ΓÇ£sortable headers that donΓÇÖt sortΓÇ¥.

Implementation approach (recommended):

- Add `sortBy` + `sortDir` state to each archive page.
- Pass `onSort` to `DynamicTable`.
- Include `sortBy`/`sortDir` in the archive fetch query params.
- Ensure API routes support sorting for archived queries.

Archive pages targeted:

- `app/(dashboard)/admin/archive/accounts/page.tsx`
- `app/(dashboard)/admin/archive/contacts/page.tsx`
- `app/(dashboard)/admin/archive/opportunities/page.tsx`
- `app/(dashboard)/admin/archive/revenue-schedules/page.tsx`
- `app/(dashboard)/admin/archive/products/page.tsx`
- `app/(dashboard)/admin/archive/groups/page.tsx`
- `app/(dashboard)/admin/archive/tickets/page.tsx`
- `app/(dashboard)/admin/archive/activities/page.tsx`

Acceptance criteria:

- Clicking a sortable column header actually changes row order.
- Sort state persists across pagination changes (and vice versa).
- If server-side sort: sorting applies to the full dataset, not just the current page.

### Phase 2 ΓÇö Enable Column Filters (2ΓÇô4 days)

Goal: bring back the standard `ListHeader` filter UX and make it work against archived datasets.

- Turn on `showColumnFilters` for archive pages.
- Provide `filterColumns`, `columnFilters`, `onColumnFiltersChange` wiring.
- Decide whether archive filters are:
  - **server-side** (recommended; consistent with pagination), or
  - **client-side** (fastest, but only filters the current page; generally not desirable)
- Add API support for filtering for each entityΓÇÖs archive query:
  - normalize operators (`contains`, `equals`, etc.)
  - validate allowed filter columns per entity (avoid arbitrary DB field filtering)

Acceptance criteria:

- Column filters narrow results correctly and predictably.
- Filters + sort + search combine without breaking pagination.

### Phase 3 ΓÇö Column Settings + Persisted Preferences (3ΓÇô6 days)

Goal: reuse the standard table preference stack (column visibility/order/widths/page size) in archive pages.

- Add settings UI:
  - `onSettingsClick` ΓåÆ `ColumnChooserModal`
  - pass `onColumnsChange` into `DynamicTable`
- Add preference load/save behavior consistent with main lists (same hook/pattern used in the entityΓÇÖs standard page).
- Persist (at minimum):
  - visible columns
  - column order
  - widths
  - page size

Acceptance criteria:

- Users can hide/show columns and it persists.
- Page size persists.
- No regressions in selection + bulk actions when columns change.

### Phase 4 ΓÇö Bulk Actions Parity (2ΓÇô5 days, entity-dependent)

Goal: add the ΓÇ£standard bulk action setΓÇ¥ where itΓÇÖs safe and meaningful for archived records.

Recommended baseline for archive pages:

- Keep: **Restore/Reopen**, **Permanent Delete**
- Add where applicable:
  - **Export CSV** (archived subset)
  - **Bulk Restore/Reopen** (already present on most)
  - Consider: **Bulk owner reassignment** only if restoration doesnΓÇÖt guarantee ownership rules (often unnecessary)

Notes:

- Some ΓÇ£standardΓÇ¥ bulk actions donΓÇÖt make sense for archived records (e.g., ΓÇ£StatusΓÇ¥ on something already archived).
- For Tickets/Activities/Reports, main export is currently ΓÇ£queuedΓÇ¥; decide whether to implement export once and share logic between main + archive.

Acceptance criteria:

- Bulk actions have consistent labels/tooltips across entities.
- Export, if implemented, produces correct rows/columns and is permission-gated.

### Phase 5 ΓÇö Standardize Archive Metadata Columns (2ΓÇô4 days + DB/audit availability)

Goal: make archive lists explain ΓÇ£why/whenΓÇ¥ something is in archive.

- Standardize column naming:
  - ΓÇ£Archived OnΓÇ¥ (consistent label)
  - optionally ΓÇ£Archived ByΓÇ¥ and ΓÇ£Archive ReasonΓÇ¥ if data exists
- Normalize per entity:
  - Accounts currently use `updatedAt` for ΓÇ£Archived OnΓÇ¥ (verify correctness vs `deletedAt`)
  - Groups show ΓÇ£Created OnΓÇ¥ instead of ΓÇ£Archived OnΓÇ¥
  - Tickets show ΓÇ£Closed OnΓÇ¥ sourced from `dueDate` (verify semantic mismatch)
  - Products have no ΓÇ£Archived OnΓÇ¥ column
  - Opportunities have no ΓÇ£Archived OnΓÇ¥ column
- Add/extend API payloads to include these fields consistently.

Acceptance criteria:

- Every archive list includes an ΓÇ£Archived OnΓÇ¥ column that reflects the true archive event time.
- Metadata fields are consistent across archive pages.

### Phase 6 ΓÇö Finish ΓÇ£Archived ReportsΓÇ¥ (decision required) (1ΓÇô3 days)

Current state:

- `app/(dashboard)/admin/archive/reports/page.tsx` is a stub and explicitly says archive/restore isnΓÇÖt supported yet.

Options:

1. Remove ΓÇ£Archived ReportsΓÇ¥ from Admin Archive until the Reports module supports real persistence + archival.
2. Implement report persistence + archive semantics, then build the archive list with Phases 1ΓÇô5.

Acceptance criteria (if implemented):

- Archive Reports behaves like other archive lists (search/sort/filters/preferences/restore/delete).

### Phase 7 ΓÇö Regression + Consistency Sweep (1ΓÇô2 days)

- Verify permissions:
  - archive view gating is consistent and correct across entities
  - restore/delete endpoints enforce permissions server-side
- Validate combined state interactions:
  - selection across pages (and how ΓÇ£select allΓÇ¥ behaves with server pagination)
  - filter/search resets selection appropriately
- Update docs and add a small parity checklist to prevent drift.
