# Revenue Schedule Detail V2 - Parity Plan

This document outlines how to bring the live **Revenue Schedule Detail V2** implementation (`components/revenue-schedule-details-view.tsx` and `components/revenue-schedule-supporting-details.tsx`) into parity with the **mockup implementation** (`scripts/RevenueScheduleDetail_Mockup_design_example.tsx`) and the spec (`docs/specs/Revenue Schedule Detail Module.md`).

The plan is organized by feature area with a concrete checklist you can track in Jira or via PRs.

## Progress (as of 2025-12-16)

- [x] Phase 1: Header parity (structure + fields)
- [x] Phase 2: Financial Summary parity
- [x] Phase 3: Tabs parity - core data/layout
- [x] Phase 4: Activities & Tickets columns (keep current table style)
- [x] Phase 5: Inline editing enhancements (manual adjustments)
- [~] Phase 6: Backend field gaps (IDs + Billing Month done; payout-backed receivables added; remaining items below)

Notes / known constraints:
- Tickets "Due Date" is currently sourced from `closedAt` (schema has no explicit due date field yet).
- "Expected Commission Adjustment" is persisted via the existing `RevenueSchedule.actualCommissionAdjustment` field (no dedicated expected-adjustment column exists today).
- Split-level receivables and payment rows are now backed by a payout source of truth via `CommissionPayout` (requires DB migration + recording payouts).
- `next build` currently fails due to an unrelated pre-existing type error in `app/api/reconciliation/deposits/import/route.ts` (not caused by these changes).

---

## 1. Header / Top Panel

Goal: Match the three-column "Opportunity Overview / Partner Information / Additional Details" header area from the mockup, including status pills and key fields.

### 1.1 Layout & Visual Structure

- [x] Add an explicit header bar above the three columns:
  - [x] Title: `REVENUE SCHEDULE DETAIL` (all caps, per mock).
  - [x] Status pill for `scheduleStatus` using existing `statusPillClass`.
  - [x] Dispute pill (e.g. "In Dispute") using `disputePillClass` when `schedule.inDispute` is true.
  - [x] Primary actions aligned right: `Create Ticket` and `Update` buttons, reusing existing handlers.
- [x] Add section headings above each header column:
  - Column 1: **Opportunity Overview**.
  - Column 2: **Partner Information**.
  - Column 3: **Additional Details**.

### 1.2 Field Coverage & Placement

Align header fields with spec section **3.1 Header Section** and the mockup.

**Column 1 - Opportunity Overview**

- [x] Ensure the following fields are present and in this order:
  - [x] `Revenue Schedule Name` (hyperlinked/editable as now).
  - [x] `Revenue Schedule Date`.
  - [x] `Opportunity` (linked label).
  - [x] `Revenue Month` (from `opportunityProduct.revenueStartDate`, with fallback to schedule date).
  - [x] `Product Name - House` (from `opportunityProduct.productNameHouseSnapshot` or `product.productNameHouse`).
  - [x] `Opportunity Owner` (from `opportunity.owner.fullName`).

- [x] Data decisions:
  - [x] Extend `RevenueScheduleDetailRecord` to include required header fields.
  - [x] Wire these from the backend API and ensure they hydrate the detail record.

**Column 2 - Partner Information**

- [x] Confirm fields and order:
  - [x] `Subagent` (`subagentName`).
  - [x] `House Rep` (`houseRepName`).
  - [x] `Distributor` (`distributorName` with account link if ID present).
  - [x] `Vendor` (`vendorName` with account link if ID present).
  - [x] `Payment Type` (`paymentType`).
  - [x] `Comments` (wide input in edit mode).

- [ ] Comments behavior:
  - [x] Keep existing inline editing behavior, but ensure the header "Comments" row stretches full width inside Column 2.
  - [ ] In read-only mode, render multi-line comments (no truncation) while keeping a tooltip fallback.

**Column 3 - Additional Details**

- [x] Confirm fields and order:
  - [x] `Account Name` (linked to account when `accountId` is a UUID).
  - [x] `Account Legal Name` (`legalName ?? accountName`).
  - [x] `Shipping Address` (truncated with tooltip).
  - [x] `Billing Address` (truncated with tooltip).
- [x] Remove duplicated commission/split fields from Column 3 when redesign is enabled (legacy mode retains them).

---

## 2. Financial Summary (Usage / Commission / Splits)

Goal: Make the collapsible Financial Summary section visually and functionally match the mockup's three cards.

### 2.1 General Behavior

- [x] Keep `FinancialSummarySection` as the V2 implementation but align fields/labels.
- [x] Default to expanded on initial load.
- [x] Maintain the "Expand/Collapse" toggle and icon per current implementation.

### 2.2 Usage Summary Card

- [x] Confirm fields:
  - [x] `Quantity`.
  - [x] `Price Per` (display `x {price}`).
  - [x] `Expected Usage Gross`.
  - [x] `Expected Usage Adjustment`.
  - [x] `Expected Usage Net`.
  - [x] `Actual Usage` (clickable to Transactions tab).
  - [x] `Usage Difference (+/-)`.
- [x] Validate visual rules:
  - [x] Bold rows for `Expected Usage Net` and `Usage Difference (+/-)`.
  - [x] Color `Usage Difference` text green/red/gray based on sign and zero.

### 2.3 Commission Summary Card

- [x] Add missing `Billing Month` row:
  - [x] Added `billingMonth` to the detail payload (derived from the earliest matched deposit month, when available).
- [x] Confirm fields:
  - [x] `Expected Commission`.
  - [x] `Expected Commission Adjustment`.
  - [x] `Expected Commission Net`.
  - [x] `Actual Commission` (clickable to Transactions tab).
  - [x] `Commission Difference` (signed value, expected net minus actual).
- [x] Validate visual rules:
  - [x] Bold rows for `Expected Commission Net` and `Commission Difference`.
  - [x] Color `Commission Difference` text green/red/gray based on sign and zero.

### 2.4 Splits Card

- [x] Keep `% / $` toggle:
  - [x] `%` mode shows House/House Rep/Subagent split % + Total Split %.
  - [x] `$` mode shows split dollars (using commission as base) + Total Split.
- [x] Confirm the card also shows:
  - [x] `Expected Rate %` (inline editable).
  - [x] `Actual Rate %` clickable to Transactions.
  - [x] `Commission Rate Difference` with signed percent formatting.

---

## 3. Supporting Details - Tabs & Sections

Goal: Ensure each tab (Opportunity Details, Additional Information, Commission Splits, Transactions, Activities, Tickets) matches the mockup's intent and column coverage.

### 3.1 Tab Navigation

- [x] Use `REDESIGN_SECTION_ITEMS` ordering and labels to mirror mock tabs.
- [x] Confirm horizontal tabs remain default when `enableRedesign` is true, with the first tab set to `Opportunity Details`.

### 3.2 Opportunity Details Tab

- [x] Align the `opportunityColumns` definitions with the spec's "Account, Order, Customer, Location & Service IDs" table.
  - [x] Removed hard-coded placeholders; uses schedule/opportunity IDs from the detail payload.
  - [x] Labels match the mock intent.
  - [x] API + `RevenueScheduleDetailRecord` include and surface the needed fields.

### 3.3 Additional Information Tab

- [x] Confirm Additional Information tab behavior (matched deposit cards + metadata columns) remains aligned with the spec.
- [x] Keep `isKnownIdKey` logic so ID-like fields continue to flow to Opportunity Details rather than Additional Information.
- [x] UX check: PillTabs for multiple deposits corresponds to the mock's multi-card behavior.

### 3.4 Commission Splits Tab

- [x] Use `renderCommissionSplitsRedesign` as the primary implementation; align it with the mock's three panels.
- [x] Update split-level receivables totals using real payout transactions (via `CommissionPayout` + "Record Payment" modal).

### 3.5 Transactions Tab (Transaction Ledger)

- [x] Confirm filter controls, transaction count, and columns match the mock intent.
- [x] Totals row uses the filtered data set (derived totals).
- [x] Ensure `Actual Usage`, `Actual Commission`, and `Actual Rate` clicks switch to the Transactions tab.

### 3.6 Activities Tab

- [x] Activities table column coverage matches the mock intent (ID, Date, Type, Owner, Description, Status, Attachment, File Name, Created By) while keeping current `DynamicTable` style.

### 3.7 Tickets Tab

- [x] Expand Tickets columns (keeping current `DynamicTable` style) to cover mock intent: Ticket #, Created, Issue, Priority, Status, Owner, Due Date, Requestor (plus Distributor/Vendor/Opportunity context).
- [x] Ensure multi-select, pagination, and `TicketCreateModal` defaults remain intact.

---

## 4. Inline Editing & Data Model Adjustments

Goal: Support the same editable fields called out in the spec while staying within the V2 inline editing framework.

- [x] Review "Manual User Adjustments" list from the spec:
  - `Usage (Bill Amount)`, `Expected Usage Adjustment`, `Quantity`, `Price Per (ea)`, `Expected Commission Rate %`.
- [x] Extend `RevenueScheduleInlineForm` and `useEntityEditor` wiring to support:
  - [x] `quantity`.
  - [x] `priceEach`.
  - [x] `expectedUsageAdjustment`.
  - [x] `expectedCommissionAdjustment`.
- [x] Add editable controls in the Financial Summary cards and persist via PATCH (including recompute of dependent amounts where possible).
- [ ] Confirm validation:
  - [x] Positive numeric checks for `quantity` and `priceEach`.
  - [x] 0-100 range for `expectedCommissionRatePercent` (and split percents + 100% total).
  - [ ] Full consistency with all validation rules in the spec's **2.6 Validation Checks**.

---

## 5. API & Backend Considerations (High-Level)

To fully support parity, the backend must expose or calculate several additional fields:

- [x] For the header:
  - [x] `revenueMonth` (YYYY-MM).
  - [x] `productNameHouse`.
  - [x] `opportunityOwnerName`.
- [x] For Financial Summary:
  - [x] `billingMonth` / `billingDate` (derived from deposit matches when available).
  - [x] Usage/commission fields exposed and wired through the detail payload.
- [x] For tabs:
  - [x] Opportunity IDs surfaced and displayed.
  - [x] Ticket fields (priority, owner/requestor, dates) surfaced and displayed.
  - [x] Split-level receivables balances derived from real payout transactions (`CommissionPayout`).

Each new property should be added to `RevenueScheduleDetailRecord` and wired through the API client and server handler layers.

---

## 6. Implementation Phasing

Suggested order of work to keep PRs small and reviewable:

1. **Header Parity (Structure + Fields)**.
2. **Financial Summary Parity**.
3. **Tabs Parity - Data & Layout**.
4. **Activities & Tickets Columns**.
5. **Inline Editing Enhancements**.
6. **Backend Field Gaps**.
   - Remaining: comments read-only multi-line; full validation rules from spec; (optional) payout void/edit UI and ledger persistence.

Track each phase with its own PR so design and product can validate against the mockup and the `Revenue Schedule Detail Module` spec.
