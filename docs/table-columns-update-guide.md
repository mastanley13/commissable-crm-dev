# Safe Guide: Adding or Updating Table Columns

This guide documents the safest way to add or update table columns so the column chooser, headers, and saved preferences continue to work. The app is currently using the straightforward pipeline (as of commit `4184eff`) where `useTablePreferences` only tracks column order, widths, and visibility.

## Safe Process

- Add the new column to the page’s base column array.
- Ensure the API returns a property that matches the column’s `accessor` (or `id` if no `accessor`).
- Decide default visibility by updating the page’s default-visible set (or mark hidden by default).
- If filterable/sortable, wire it into the page’s sort/filter options.
- Validate in UI: chooser shows it, toggle persists, browser reload keeps it.

## Frontend Changes

Define the column in the page’s base array:

- Accounts: `app/(dashboard)/accounts/page.tsx`
- Contacts: `app/(dashboard)/contacts/page.tsx`
- Opportunities: `app/(dashboard)/opportunities/page.tsx` (`BASE_COLUMNS`)

Column shape (essentials):

- `id`: stable string key (do not rename post-release)
- `label`: user-facing header
- `width`, `minWidth`: use `calculateMinWidth({ label, type, sortable })`
- `type`: `"text" | "email" | "phone" | "toggle" | "action" | "multi-action"`
- `accessor` (optional): data key if it differs from `id`
- `render` (optional): custom cell content (links, formatting)
- `sortable` (boolean): enables header sort arrows
- `hideable` (optional): set `false` to pin column (cannot be hidden)

Default visibility:

- Add the column’s `id` to the page’s default-visible set if you want it visible on first load:
  - Accounts: `ACCOUNT_DEFAULT_VISIBLE_COLUMN_IDS` in `app/(dashboard)/accounts/page.tsx`
  - Contacts: `CONTACT_DEFAULT_VISIBLE_COLUMN_IDS` in `app/(dashboard)/contacts/page.tsx`
  - Opportunities: keep hidden by default or mirror the Accounts/Contacts pattern by introducing a visible set.
- The page’s “default visibility” effect flips visibility once and `useTablePreferences` persists it.

Filters and sorting:

- To make the column filterable, add it to the page’s filter options (e.g., `filterOptions` on Accounts, `OPPORTUNITY_FILTER_OPTIONS` on Opportunities).
- Sorting: mark the column `sortable: true`, and ensure the page’s sort handler can read the value by `id` (or `accessor`).

## Backend Changes

Ensure the list API returns the field used by the column:

- Contacts: `app/api/contacts/route.ts`
- Opportunities: `app/api/opportunities/route.ts`
- Accounts: the list endpoint your page calls (e.g., `/api/accounts`).

If Prisma powers the response, include the field in the `select` or compute it server-side. For a new DB column, update `prisma/schema.prisma` plus migrate/push, then expose the value in the API response.

## Preferences Compatibility

- `useTablePreferences` persists only `columnOrder`, `columnWidths`, and `hiddenColumns`.
- Adding a new column is non-breaking:
  - If the saved `columnOrder` doesn’t include the new id, it is appended.
  - Page-level default visibility decides initial visibility, then persists.
- Avoid renaming `id` values post-release; change `label` freely.

## Gotchas to Avoid

- Mismatched keys: if data is `row.websiteUrl` but `id` is `website`, set `accessor: 'websiteUrl'`.
- Default visibility: include new `id` in the default-visible set if it should appear right away.
- Pinned columns: set `hideable: false` for must-show columns; chooser will not hide them.

## Mini Example (Accounts)

Add a “Territory” column:

Frontend (in `app/(dashboard)/accounts/page.tsx` base array):

```ts
{
  id: 'territory',
  label: 'Territory',
  width: 160,
  minWidth: calculateMinWidth({ label: 'Territory', type: 'text', sortable: true }),
  sortable: true,
  type: 'text',
  accessor: 'territory', // must match the API field name
}
```

Default visibility (optional): add `'territory'` to `ACCOUNT_DEFAULT_VISIBLE_COLUMN_IDS`.

Filter option (optional):

```ts
{ id: 'territory', label: 'Territory' }
```

Backend: ensure the accounts list API returns `territory` for each row.

---

If you share the page and field name(s), we can patch the base column arrays, default-visible sets, and API selects for you.

