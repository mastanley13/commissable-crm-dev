Here’s a concrete, code‑anchored plan to add a “Revenue Schedules” tab to Opportunity Details, aligned with your table standards and Field IDs 03.05.000–03.05.020.

Scope

Add a “Revenue Schedules” tab to components/opportunity-details-view.tsx showing schedule rows for the current opportunity.
Follow Detail_View_Tables_Reference_Guide standards: DynamicTable + ListHeader + ColumnChooser + preferences.
Map columns to Field IDs 03.05.000–03.05.020 with correct labels, accessors, formatting, and derived formulas.
Backend: extend the Opportunity GET to include revenue schedules and provide shape the UI can consume.
High‑Level Steps

Map revenue schedule fields to columns and formulas.
Define row type and API mapping for schedules.
Extend API GET for opportunities to include schedules.
Add “Revenue Schedules” tab, columns, and table state.
Hook up table preferences and filters.
Add CSV export and row rendering formatters.
Light QA and docs checklist.
Field Mapping (03.05.000–03.05.020)

03.05.000 Distributor Name → distributorName from revenueSchedule.distributor.accountName.
03.05.001 Vendor Name → vendorName from revenueSchedule.vendor.accountName.
03.05.002 Revenue Schedule Name → scheduleNumber (label “Revenue Schedule”).
03.05.003 Revenue Schedule Date → scheduleDate (ISO → date).
03.05.004 Schedule Status → status (enum → label).
03.05.005 Product Name - Vendor → productNameVendor from revenueSchedule.product.productNameVendor.
03.05.006 Quantity → quantity from revenueSchedule.opportunityProduct.quantity (fallback: 1).
03.05.007 Price Each → unitPrice from revenueSchedule.opportunityProduct.unitPrice (fallback: product.priceEach).
03.05.008 Expected Usage Gross → expectedUsageGross from revenueSchedule.expectedUsage.
03.05.009 Expected Usage Adjustment → expectedUsageAdjustment from revenueSchedule.usageAdjustment (nullable → 0).
03.05.010 Expected Usage Net → expectedUsageNet = expectedUsageGross + expectedUsageAdjustment.
03.05.011 Actual Usage → actualUsage from revenueSchedule.actualUsage.
03.05.012 Usage Balance → usageBalance = expectedUsageNet - actualUsage.
03.05.013 Expected Commission Gross → expectedCommissionGross from revenueSchedule.expectedCommission (or compute).
03.05.014 Expected Commission Adjustment → expectedCommissionAdjustment (not in schema; Phase 2; use 0 for display).
03.05.015 Expected Commission Net → expectedCommissionNet = expectedCommissionGross + expectedCommissionAdjustment.
03.05.016 Actual Commission → actualCommission from revenueSchedule.actualCommission.
03.05.017 Commission Difference → commissionDifference = expectedCommissionNet - actualCommission.
03.05.018 Expected Commission Rate % → expectedCommissionRatePercent from product.commissionPercent if present; fallback compute expectedCommissionGross / expectedUsageNet.
03.05.019 Actual Commission Rate % → actualCommissionRatePercent = actualCommission / actualUsage.
03.05.020 Commission Rate Difference → commissionRateDifferencePercent = expectedCommissionRatePercent - actualCommissionRatePercent.
Note on formatting: currency fields use the same formatCurrency as Products; percent renders as integer percent with “%”; dates via formatDate.

Backend Changes

Update Opportunity GET to load schedules:
File: app/api/opportunities/[opportunityId]/route.ts:100
Include revenueSchedules: { include: { product: { select: { productNameVendor, commissionPercent, priceEach } }, distributor: { select: { accountName: true } }, vendor: { select: { accountName: true } }, opportunityProduct: { select: { quantity: true, unitPrice: true } } }, orderBy: { scheduleDate: 'asc' } }
After fetching, map schedules into a client shape and add to detail.
Add mapping helper:
File: app/api/opportunities/helpers.ts: add mapRevenueScheduleToDetail(schedule) and OpportunityRevenueScheduleDetail type that computes the derived columns above with numeric guards and null→0 fallbacks.
Extend mapOpportunityToDetail to include revenueSchedules: mapped.
Types

File: components/opportunity-types.ts:1
Add:
export interface OpportunityRevenueScheduleRecord { id; distributorName; vendorName; scheduleNumber; scheduleDate; status; productNameVendor; quantity; unitPrice; expectedUsageGross; expectedUsageAdjustment; expectedUsageNet; actualUsage; usageBalance; expectedCommissionGross; expectedCommissionAdjustment; expectedCommissionNet; actualCommission; commissionDifference; expectedCommissionRatePercent; actualCommissionRatePercent; commissionRateDifferencePercent; createdAt?; updatedAt? }
Add revenueSchedules?: OpportunityRevenueScheduleRecord[] to OpportunityDetailRecord.
UI: Tab, Columns, State

Add TabKey:
File: components/opportunity-details-view.tsx:916
Append "revenue-schedules" to type TabKey = ....
Add tab button:
File: components/opportunity-details-view.tsx:2563
Extend array to include "revenue-schedules" and label it “Revenue Schedules”.
Add tab content branch:
File: components/opportunity-details-view.tsx:2602
Insert : activeTab === "revenue-schedules" ? ( ...table layout... ) :
Define table constants following the guide:
File: components/opportunity-details-view.tsx (near PRODUCT/ACTIVITY constants)
Add REVENUE_FILTER_COLUMNS with ids: productNameVendor, scheduleNumber, scheduleDate, status, vendorName, distributorName.
Add REVENUE_TABLE_BASE_COLUMNS: Column[]:
multi-action (hideable: false)
productNameVendor (200/160), vendorName (180/150), distributorName (180/150)
scheduleNumber (160/130), scheduleDate (150/130), status (160/130)
quantity (120/100, number), unitPrice (140/120, currency)
expectedUsageGross (160), expectedUsageAdjustment (180), expectedUsageNet (160), actualUsage (140), usageBalance (160)
expectedCommissionGross (180), expectedCommissionAdjustment (200), expectedCommissionNet (180), actualCommission (160), commissionDifference (180)
expectedCommissionRatePercent (160), actualCommissionRatePercent (160), commissionRateDifferencePercent (180)
Table state/wiring (follow Products tab pattern, omit status toggle):
const [revenueSearchQuery, setRevenueSearchQuery] = useState(\"\")
const [revenueColumnFilters, setRevenueColumnFilters] = useState<ColumnFilter[]>([])
Pagination: revenueCurrentPage, revenuePageSize, computed paginatedRevenueRows and revenuePagination.
Selection: selectedRevenueRows, handlers, and handleSelectAllRevenueRows.
Preferences: useTablePreferences("opportunities:detail:revenue-schedules", REVENUE_TABLE_BASE_COLUMNS).
Filters: use applySimpleFilters + text search across key fields.
Renderers:
Currency: unitPrice, usage/commission amounts → formatCurrency
Percent: rate columns → formatPercent
Dates: scheduleDate → formatDate
Status chip → style same as Activities status renderer.
ListHeader setup for this tab:
showCreateButton={false}
onSearch={setRevenueSearchQuery}
filterColumns={REVENUE_FILTER_COLUMNS}
columnFilters={revenueColumnFilters} + onColumnFiltersChange
Omit statusFilter to avoid the active/inactive toggle (schedules use status).
Left accessory: Schedules: {filteredRevenueRows.length.toLocaleString()}
Optional: CSV Export

Mimic Products export with schedule fields and formatted values.
Keep bulk action bar minimal (export only) for Phase 1; editing/deletion later.
File Touch Points

app/api/opportunities/[opportunityId]/route.ts:100
app/api/opportunities/helpers.ts: add schedule mapper and extend detail payload
components/opportunity-types.ts:1
components/opportunity-details-view.tsx:916, 2563, 2602 (+ constants near top)
Standards & UX Notes

Column widths per Detail_View_Tables_Reference_Guide.md.
Table preferences key: opportunities:detail:revenue-schedules.
Keep consistent styles with Products/Roles tabs: multi-action column, ColumnChooser modal, empty state msg.
No row toggles in Phase 1 (no active/inactive on schedules); rely on status column and filters.
Assumptions / Phase 2

Commission adjustment fields are not in schema; Phase 2 can add expectedCommissionAdjustment to RevenueSchedule if needed. Until then show 0 and derive Net/Difference accordingly.
If CRUD is needed (create/edit/delete schedules), add a dedicated bulk/action bar and API routes (out of current scope).
Acceptance Criteria

New “Revenue Schedules” tab appears, selectable alongside existing tabs.
Table renders for current opportunity with all fields 03.05.000–03.05.020, correct labels and formats.
Search, column filters, pagination, selection, and column chooser work.
Preferences persist (order/visibility).
CSV export (optional) includes visible schedule rows.