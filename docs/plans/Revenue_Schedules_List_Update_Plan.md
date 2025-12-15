# Revenue Schedules List — Update Plan

Version: 1.0  
Last Updated: 2025-10-15

Purpose: Align the Revenue Schedules list page with the standardized list-page patterns used by Accounts, Contacts, and Opportunities, and bring the visible columns into compliance with the Fields by Page specification (IDs 04.00.000–04.00.023).

---

## Snapshot of Current Implementation

- Uses custom header UI instead of the shared `ListHeader` component.
- Columns defined in `app/(dashboard)/revenue-schedules/page.tsx` with client-side sort/search over mock data.
- Multi-action column includes a selection checkbox and an Active toggle; the Active concept does not exist for revenue schedules.
- Missing many finance/ID/status columns specified by the CSV; some non-spec columns are present.

---

## Gap Analysis — Columns (CSV 04.00.000–04.00.023)

Legend: Present = implemented; Missing = not implemented; Rename = implemented but label/semantics differ; Remove = present but not in spec.

| ID | CSV Field Label | Current Column | Status | Notes / Plan |
|----|------------------|----------------|--------|--------------|
| 04.00.000 | Distributor Name | — | Missing | Add column `distributorName` (text). |
| 04.00.001 | Vendor Name | Vendor Name | Present | Keep; ensure type text, sortable. |
| 04.00.002 | Account Name | Account Name | Present | Keep; clickable primary field behavior. |
| 04.00.003 | Product Name - Vendor | Product Name - Vendor | Present | Keep; clickable blue text style. |
| 04.00.004 | Revenue Schedule Date | Revenue Schedule Date | Present | Keep; type date. |
| 04.00.005 | Revenue Schedule Name | Revenue Schedule | Present | Rename label to “Revenue Schedule Name”. |
| 04.00.006 | Quantity | — | Missing | Add number column. |
| 04.00.007 | Price Each | — | Missing | Add currency column. |
| 04.00.008 | Expected Usage Gross | Expected Usage | Rename | Rename label; confirm value is Quantity × Price Each. |
| 04.00.009 | Expected Usage Adjustment | Usage Adjustment | Present | Keep (currency). |
| 04.00.010 | Expected Usage Net | — | Missing | Add computed column (Gross + Adjustment). |
| 04.00.011 | Actual Usage | — | Missing | Add currency column (from reconciled deposit line match). |
| 04.00.012 | Usage Balance | — | Missing | Add computed column (Net − Actual). |
| 04.00.013 | Expected Commission Net | — | Missing | Add currency column (Net × Expected Commission Rate %). |
| 04.00.014 | Actual Commission | — | Missing | Add currency column. |
| 04.00.015 | Commission Difference | — | Missing | Add computed column (Expected Commission Net − Actual Commission). |
| 04.00.016 | Customer ID - Vendor | — | Missing | Add text/ID column. |
| 04.00.017 | Order ID - Vendor | — | Missing | Add text/ID column. |
| 04.00.018 | Location ID | — | Missing | Add text/ID column. |
| 04.00.019 | Opportunity ID | Opportunity ID | Present | Keep; sortable. |
| 04.00.020 | Customer ID - Distributor | Distributor ID | Rename | Rename label and field key to `customerIdDistributor`. |
| 04.00.021 | Order ID - Distributor | — | Missing | Add text/ID column. |
| 04.00.022 | Schedule Status | — | Missing | Add enum column: Open, Reconciled, In Dispute. |
| 04.00.023 | In Dispute | — | Missing | Add boolean column; read-only (edited via ticketing). |

Non-spec columns currently present:
- Account Legal Name — Remove or hide by default (not part of 04.00.* list).
- Order ID - House — Remove or hide by default (not in spec for this list).
- Active toggle in multi-action — Remove (not applicable to schedules).

---

## Alignment with Standard List-Page Architecture

- Replace custom header with `ListHeader` to standardize:
  - Page title, search input, filter controls, column filter dropdown, column settings button, create button (if applicable).
  - Table preference save UI via `TableChangeNotification` (already present; keep).
- Use `DynamicTable` with a spec-compliant “multi-action” column:
  - Selection checkbox, edit and manage buttons only (no Active toggle).
  - Ensure interactive elements include `data-disable-row-click="true"` to prevent navigation conflicts.
- Table preferences via `useTablePreferences` with default-visibility normalization consistent with the guide.
- Bulk actions bar mirroring other lists: Export CSV is in-scope; deletion is not (schedules are reconciled entities). Optionally: “Create Ticket” bulk initializer.
- Row click navigates to a schedule detail page (future: `/revenue-schedules/[id]`) or the parent opportunity’s schedules tab.

---

## Data Loading Strategy

- Prefer server-side pagination (dataset can be large) matching the Contacts pattern.
- Endpoints (to implement):
  - GET `/api/revenue-schedules` — params: `page`, `pageSize`, `q`, `sortBy`, `sortDir`, `startDate`, `endDate`, `status`, `inDispute`, `columnFilters` (JSON), IDs (customer/vendor/distributor, opportunityId, locationId, orderIdVendor/distributor).
  - GET `/api/revenue-schedules/options` — lookups (vendors, distributors, statuses) for filters.
  - GET `/api/revenue-schedules/:id` (future detail route).
- Return shape should match `DynamicTable` expectations and include `pagination` metadata.

---

## Filters & Search

- Global search `q` (server-side) over: revenue schedule name/ID, account name, vendor/distributor name, product name, external IDs.
- Quick filters in header:
  - Status: All, Open, Reconciled, In Dispute (single-select).
  - Date range: `revenueScheduleDate` start/end.
  - In Dispute: toggle (filters to true).
- Column filters (dropdown) per standard, e.g.: `accountName`, `vendorName`, `distributorName`, `productNameVendor`, `opportunityId`, `customerIdVendor`, `orderIdVendor`, `customerIdDistributor`, `orderIdDistributor`, `locationId`.
- Debounce search input (300ms) per server-side pattern.

---

## Default Visible Columns (first-load normalization)

Visible by default:
- Multi-action
- Account Name
- Vendor Name
- Distributor Name
- Product Name - Vendor
- Revenue Schedule Date
- Revenue Schedule Name
- Expected Usage Gross
- Expected Usage Adjustment
- Expected Usage Net
- Expected Commission Net
- Actual Commission
- Commission Difference
- Schedule Status
- In Dispute

Hidden by default (available in chooser):
- Quantity, Price Each
- Actual Usage, Usage Balance
- Customer ID - Vendor, Order ID - Vendor, Location ID, Opportunity ID, Customer ID - Distributor, Order ID - Distributor

Note: Keep “Account Legal Name” and “Order ID - House” hidden or remove entirely to match 04.00.* scope.

---

## UI/UX Updates

- Replace custom header with:
  - `ListHeader` props: `pageTitle="REVENUE SCHEDULES LIST"`, `onSearch`, `onFilterChange` (status), `filterColumns`, `columnFilters`, `onColumnFiltersChange`, `onSettingsClick`.
  - Show `TableChangeNotification` (already wired) within header area.
- `DynamicTable` props: enable `fillContainerWidth`, disable `autoSizeColumns` if widths are tuned; pass `pagination` and handlers.
- Multi-action column: remove Active toggle; keep Edit/Delete as appropriate (hard delete generally disabled; consider “Manage” to open detail).
- BulkActionBar: `onExportCsv`, optionally `onCreateTicket` (future integration).

---

## Implementation Plan (Phased)

1) Columns and Table Config
- Add/rename/remove columns per the Gap Analysis.
- Define `Column[]` types: use `text`, `date`, `currency`, `boolean` according to the guide.
- Implement default-visibility normalization using `useTablePreferences`.

2) Header Standardization
- Swap custom header for `ListHeader`.
- Wire search, status filter, date range, column filters, settings modal, and table save.

3) Server-Side Pagination & API
- Build `/api/revenue-schedules` list endpoint with pagination, sorting, search, filters, and columnFilters JSON.
- Adopt the Contacts page data-loading pattern with debounce and `pagination` state.

4) Selection, Bulk Actions, Row Actions
- Use standardized selection state (`selectedItems`) and handlers.
- Add `BulkActionBar` with CSV export; remove bulk delete.
- Row click navigates to schedule detail (future) or parent opportunity.

5) Clean-up & Consistency
- Remove non-spec columns (or hide by default) and the Active toggle.
- Ensure currency/number/date formatting matches other lists.
- Add toasts for load/mutation feedback via `useToasts`.

6) QA & Acceptance
- Verify all CSV fields 04.00.000–04.00.023 are available as columns.
- Validate default visible set and column chooser persistence.
- Confirm server-side search, filters, sorting, and pagination behave like Contacts.
- Confirm export includes visible columns and respects selection.

---

## Risks & Considerations

- Some values (Actual Usage/Commission, Differences, Status, In Dispute) depend on reconciliation logic and deposit matching; ensure backend exposes precomputed fields or efficient views.
- Dataset can be large; server-side pagination is strongly recommended.
- “Create New” for schedules may be gated by opportunity/product context; hide or disable if not applicable from this list.

---

## Acceptance Criteria (Summary)

- Page uses `ListHeader`, `DynamicTable`, `useTablePreferences`, and standard bulk/selection patterns.
- All 04.00.000–04.00.023 fields exist as columns; default visible set matches this plan.
- Server-side pagination with debounced search, status/date filters, and column filters.
- Multi-action column contains selection + actions only (no Active toggle).
- Export CSV works for selected items.

---

## Field-to-Key Mapping (Proposed)

- distributorName (04.00.000)
- vendorName (04.00.001)
- accountName (04.00.002)
- productNameVendor (04.00.003)
- revenueScheduleDate (04.00.004)
- revenueScheduleName (04.00.005)
- quantity (04.00.006)
- priceEach (04.00.007)
- expectedUsageGross (04.00.008)
- expectedUsageAdjustment (04.00.009)
- expectedUsageNet (04.00.010)
- actualUsage (04.00.011)
- usageBalance (04.00.012)
- expectedCommissionNet (04.00.013)
- actualCommission (04.00.014)
- commissionDifference (04.00.015)
- customerIdVendor (04.00.016)
- orderIdVendor (04.00.017)
- locationId (04.00.018)
- opportunityId (04.00.019)
- customerIdDistributor (04.00.020)
- orderIdDistributor (04.00.021)
- scheduleStatus (04.00.022)
- inDispute (04.00.023)

---

## Next Actions (Developer Checklist)

- Refactor header to `ListHeader`; implement server-side load with debounce and filters.
- Implement columns per mapping; remove “Account Legal Name” and “Order ID - House” or hide by default.
- Add `/api/revenue-schedules` with pagination/sort/search/filters and return `pagination` metadata.
- Add `BulkActionBar` with CSV export; no bulk delete.
- Add default-visibility normalization per the guide; persist via `useTablePreferences`.
- Add toasts and error handling matching Contacts/Accounts patterns.


