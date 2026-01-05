# Archive Tables vs Standard Tables — Feature Gap Review (2026-01-05)

This document compares each **Admin → Archive** table against its corresponding “standard” module list table in the app and calls out **missing features / parity gaps** in the archive UX.

Scope: `app/(dashboard)/admin/archive/*/page.tsx` compared to `app/(dashboard)/*/page.tsx`.

---

## What “standard tables” typically support (observed)

Across most module list pages, the “standard” list/table experience includes:

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

All archive pages mark many columns as `sortable: true`, but do **not** pass `onSort` to `DynamicTable`.

`DynamicTable` only toggles the sort indicator unless `onSort` is provided (it does not sort `data` itself), so archive tables show “sortable headers” but the dataset does not change.

- `components/dynamic-table.tsx` (see `handleSort` and lack of any internal data sorting)
- Examples of archive tables missing `onSort`:
  - `app/(dashboard)/admin/archive/accounts/page.tsx`
  - `app/(dashboard)/admin/archive/contacts/page.tsx`
  - `app/(dashboard)/admin/archive/opportunities/page.tsx`
  - `app/(dashboard)/admin/archive/revenue-schedules/page.tsx`
  - `app/(dashboard)/admin/archive/products/page.tsx`
  - `app/(dashboard)/admin/archive/groups/page.tsx`
  - `app/(dashboard)/admin/archive/tickets/page.tsx`
  - `app/(dashboard)/admin/archive/activities/page.tsx`

### 2) Column filters are disabled across archive pages

Archive headers explicitly disable column filters:

- `ListHeader` is always called with `showColumnFilters={false}` and no filter state props.

### 3) Column settings / saved preferences are missing in archive pages

Standard lists commonly expose column settings (`onSettingsClick` → `ColumnChooserModal`) and persist table layout preferences. Archive pages do not:

- no settings button
- no `ColumnChooserModal`
- no preference persistence hooks
- no `onColumnsChange` passed into `DynamicTable` (so even drag/resize changes can’t be saved upstream)

### 4) Export / richer bulk actions are missing

Standard list pages often provide export (implemented or queued) and non-destructive bulk actions (reassign, status). Archive pages generally only provide:

- Restore/Reopen
- Permanent delete

### 5) Inconsistent “archive metadata” columns

Some archive tables show an “Archived On” column (sometimes `deletedAt`, sometimes `updatedAt`), while others show a different timestamp (or none at all). There is no consistent **Archived On / Archived By / Archive Reason** metadata surfaced.

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

- Archive list shows a small subset (Account Name, Type, Legal Name, Owner, “Archived On”).
- Main list supports many additional standardized fields (account number, active/inactive, parent account, industry, website, addresses, description, etc.) and supports choosing columns.

Archive metadata note:

- Accounts archive uses `updatedAt` labeled “Archived On” (`app/(dashboard)/admin/archive/accounts/page.tsx`).

---

### Contacts

- Main list: `app/(dashboard)/contacts/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/contacts/page.tsx`

Missing features in archive (vs main):

- **Working sort** (no `onSort`).
- **Filters parity** (main supports status + multiple column filters; archive disables them).
- **Column settings + saved preferences**.
- **Bulk actions parity** (reassign/status/export are present in main; archive only restore/permanent delete).

Column parity notes:

- Archive list includes a small subset (Name, Job Title, Account, Email, Owner, Archived On).
- Main list includes many additional standardized fields (phones, contact type, active, decision maker, preferred contact method, etc.) and column chooser support.

Archive metadata note:

- Contacts archive uses `deletedAt` labeled “Archived On” (`app/(dashboard)/admin/archive/contacts/page.tsx`).

---

### Opportunities

- Main list: `app/(dashboard)/opportunities/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/opportunities/page.tsx`

Missing features in archive (vs main):

- **Working sort** (no `onSort`).
- **Filters parity** (main has status filter + column filters; archive disables).
- **Column settings + saved preferences**.
- **Bulk actions parity** (main has owner/status/export; archive does not).

Column parity notes:

- Archive list shows only a small subset (Opportunity, Account, Owner, Stage, Status, Close Date).
- Main list supports a significantly wider set of columns (IDs, addresses, splits, distributor/vendor info, expected totals, etc.) and column chooser support.

Archive metadata note:

- Opportunities archive does not show a dedicated “Archived On” timestamp (only “Close Date”).

---

### Revenue Schedules

- Main list: `app/(dashboard)/revenue-schedules/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/revenue-schedules/page.tsx`

Missing features in archive (vs main):

- **Working sort** (no `onSort`).
- **Filters parity** (main has status/date quick filters + column filters; archive disables).
- **Column settings + saved preferences** (main supports save table changes; archive does not).
- **Bulk actions parity** (main supports export + other workflow actions; archive only restore/permanent delete).

Column parity notes:

- Archive list shows a minimal subset (Schedule name/date, Account, Distributor, Vendor, Product, Status, Archived On).
- Main list includes extensive computed/financial columns (usage/commission nets, balances, differences, IDs, etc.) plus filter and date-range UX.

Archive metadata note:

- Revenue schedules archive uses `deletedAt` as “Archived On” (`app/(dashboard)/admin/archive/revenue-schedules/page.tsx`).

---

### Products (Catalog)

- Main list: `app/(dashboard)/products/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/products/page.tsx`

Missing features in archive (vs main):

- **Working sort** (no `onSort`).
- **Filters parity** (main uses filter options + column filters; archive disables).
- **Column settings + saved preferences**.
- **Bulk actions parity** (main provides export + other actions; archive only restore/permanent delete).

Column parity notes:

- Archive list shows a subset (house/vendor names, part #, distributor/vendor, revenue type, has schedules).
- Archive list does **not** show an “Archived On” timestamp column.

---

### Groups

- Main list: `app/(dashboard)/groups/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/groups/page.tsx`

Missing features in archive (vs main):

- **Working sort** (no `onSort`).
- **Filters parity** (main supports status filter + column filters; archive disables).
- **Column settings + saved preferences**.
- **Bulk actions parity** (main supports export + reassign + status tools; archive only restore/permanent delete).

Archive metadata note:

- Groups archive shows “Created On” (not “Archived On”), so users can’t tell when a group was archived from the table (`app/(dashboard)/admin/archive/groups/page.tsx`).

---

### Tickets

- Main list: `app/(dashboard)/tickets/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/tickets/page.tsx`

Missing features in archive (vs main):

- **Working sort** (no `onSort`).
- **Filters parity** (main supports column filters + additional status/quick filtering; archive disables).
- **Column settings + saved preferences**.
- **Bulk actions parity** (main supports reassign/status; export is currently queued; archive has reopen/permanent delete only).

Archive metadata note:

- Tickets archive shows “Closed On” but the source field is `dueDate` (potential mismatch in meaning) (`app/(dashboard)/admin/archive/tickets/page.tsx`).

---

### Activities

- Main list: `app/(dashboard)/activities/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/activities/page.tsx`

Missing features in archive (vs main):

- **Working sort** (no `onSort`).
- **Filters parity** (main supports column filters; archive disables).
- **Column settings + saved preferences**.
- **Bulk actions parity** (main supports reassign/status; export is currently queued; archive only reopen/permanent delete).

Archive metadata note:

- Archive shows “Due Date” and “Created On” (hidden), but not a clear “Completed/Archived On” timestamp column (`app/(dashboard)/admin/archive/activities/page.tsx`).

---

### Reports

- Main list: `app/(dashboard)/reports/page.tsx`
- Archive list: `app/(dashboard)/admin/archive/reports/page.tsx`

Archive status:

- Archive reports page is explicitly **not implemented**:
  - “Reports are currently served from in-memory mock data and do not support archive/restore yet.”

Missing features in archive (vs main):

- Entire archive table/list experience (no listing, no restore, no permanent delete, no filtering/sorting/pagination).

---

## Suggested standardization targets (high-value)

If archive tables are intended to behave like standard list tables, the biggest gaps to close are:

1. Add **working sort** for archive pages (either client-side sort or pass `onSort` + include sort params in API requests).
2. Enable **column filters** in `ListHeader` and forward filter state into archive fetches.
3. Add **column settings + persisted preferences** (reuse the same table preferences approach used in main lists).
4. Add **consistent archive metadata** columns across all archive tables (Archived On, Archived By, Archive Reason where available).

---

## Phased Plan to Close Archive Table Gaps

This plan is designed to ship improvements safely, in small increments, while reusing the “standard list page” patterns already present in the app.

### Phase 0 — Alignment + Inventory (0.5–1 day)

- Decide per entity whether archive lists should be **server-sorted** (recommended for consistency with pagination) vs **client-sorted** (quick win but misleading with pagination).
- Confirm what “Archive” means per entity:
  - soft-delete via `deletedAt` (Accounts/Contacts/Revenue Schedules)
  - inactive via `active=false` or status field (Opportunities/Groups/Tickets/Activities/Products)
- Identify the canonical “Archived On” field per entity (and whether “Archived By” / “Archive Reason” exists in the DB/audits).
- Create a parity checklist (same set of UX capabilities across all archive pages).

Deliverable: a short decision doc + checklist used for all phases below.

### Phase 1 — Fix Sorting (highest-impact, low risk) (1–2 days)

Goal: eliminate “sortable headers that don’t sort”.

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

### Phase 2 — Enable Column Filters (2–4 days)

Goal: bring back the standard `ListHeader` filter UX and make it work against archived datasets.

- Turn on `showColumnFilters` for archive pages.
- Provide `filterColumns`, `columnFilters`, `onColumnFiltersChange` wiring.
- Decide whether archive filters are:
  - **server-side** (recommended; consistent with pagination), or
  - **client-side** (fastest, but only filters the current page; generally not desirable)
- Add API support for filtering for each entity’s archive query:
  - normalize operators (`contains`, `equals`, etc.)
  - validate allowed filter columns per entity (avoid arbitrary DB field filtering)

Acceptance criteria:

- Column filters narrow results correctly and predictably.
- Filters + sort + search combine without breaking pagination.

### Phase 3 — Column Settings + Persisted Preferences (3–6 days)

Goal: reuse the standard table preference stack (column visibility/order/widths/page size) in archive pages.

- Add settings UI:
  - `onSettingsClick` → `ColumnChooserModal`
  - pass `onColumnsChange` into `DynamicTable`
- Add preference load/save behavior consistent with main lists (same hook/pattern used in the entity’s standard page).
- Persist (at minimum):
  - visible columns
  - column order
  - widths
  - page size

Acceptance criteria:

- Users can hide/show columns and it persists.
- Page size persists.
- No regressions in selection + bulk actions when columns change.

### Phase 4 — Bulk Actions Parity (2–5 days, entity-dependent)

Goal: add the “standard bulk action set” where it’s safe and meaningful for archived records.

Recommended baseline for archive pages:

- Keep: **Restore/Reopen**, **Permanent Delete**
- Add where applicable:
  - **Export CSV** (archived subset)
  - **Bulk Restore/Reopen** (already present on most)
  - Consider: **Bulk owner reassignment** only if restoration doesn’t guarantee ownership rules (often unnecessary)

Notes:

- Some “standard” bulk actions don’t make sense for archived records (e.g., “Status” on something already archived).
- For Tickets/Activities/Reports, main export is currently “queued”; decide whether to implement export once and share logic between main + archive.

Acceptance criteria:

- Bulk actions have consistent labels/tooltips across entities.
- Export, if implemented, produces correct rows/columns and is permission-gated.

### Phase 5 — Standardize Archive Metadata Columns (2–4 days + DB/audit availability)

Goal: make archive lists explain “why/when” something is in archive.

- Standardize column naming:
  - “Archived On” (consistent label)
  - optionally “Archived By” and “Archive Reason” if data exists
- Normalize per entity:
  - Accounts currently use `updatedAt` for “Archived On” (verify correctness vs `deletedAt`)
  - Groups show “Created On” instead of “Archived On”
  - Tickets show “Closed On” sourced from `dueDate` (verify semantic mismatch)
  - Products have no “Archived On” column
  - Opportunities have no “Archived On” column
- Add/extend API payloads to include these fields consistently.

Acceptance criteria:

- Every archive list includes an “Archived On” column that reflects the true archive event time.
- Metadata fields are consistent across archive pages.

### Phase 6 — Finish “Archived Reports” (decision required) (1–3 days)

Current state:

- `app/(dashboard)/admin/archive/reports/page.tsx` is a stub and explicitly says archive/restore isn’t supported yet.

Options:

1. Remove “Archived Reports” from Admin Archive until the Reports module supports real persistence + archival.
2. Implement report persistence + archive semantics, then build the archive list with Phases 1–5.

Acceptance criteria (if implemented):

- Archive Reports behaves like other archive lists (search/sort/filters/preferences/restore/delete).

### Phase 7 — Regression + Consistency Sweep (1–2 days)

- Verify permissions:
  - archive view gating is consistent and correct across entities
  - restore/delete endpoints enforce permissions server-side
- Validate combined state interactions:
  - selection across pages (and how “select all” behaves with server pagination)
  - filter/search resets selection appropriately
- Update docs and add a small parity checklist to prevent drift.

