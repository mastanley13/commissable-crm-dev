# Vendor/Distributor -> Other Field Unification Plan

**Project:** Commissable CRM  
**Date Created:** 2026-01-12  
**Last Updated:** 2026-01-13  
**Primary Input:** `Filtered_Vendor_Distributor_Fields(Sheet1).csv`  

## Executive Summary

This plan unifies selected Vendor + Distributor fields into a single **Other** field across the application UI and API contracts.

**Key decisions (confirmed):**
- **Single field shown to users:** `Other - <Field>` (example: `Other - Account ID`)
- **Merge precedence:** `Other = Vendor-first, then Distributor` (example: `accountIdOther = accountIdVendor ?? accountIdDistributor`)
- **UI-only removals (no DB drops):** `Product Family - Vendor` and `Product Subtype - Vendor` are removed from UI surfaces but retained in DB/schema for now.

This plan is intentionally structured so we can ship "Other" without any destructive schema changes, while keeping the door open for a later true DB unification if desired.

---

## Progress / Status (as of 2026-01-13)

### What is complete (implemented)

- **Labels standardized to `Other - <Field>`** across in-scope pages for:
  - Other - Account ID
  - Other - Customer ID
  - Other - Order ID
  - Other - Product Name
  - Other - Part Number
  - Other - Product Description
- **Vendor-first precedence implemented** anywhere we render unified values: `Other = Vendor ?? Distributor`.
- **Phase 1 complete:** API responses now include computed fields (non-breaking) such as `accountIdOther`, `customerIdOther`, `orderIdOther`, `productNameOther`, `partNumberOther`, `productDescriptionOther`, and `otherSource` where applicable.
- **Phase 2 complete (remaining duplicates):** Product and Opportunity Product detail views no longer show Distributor product fields; only unified `Other - ...` fields are displayed (Vendor-first fallback).
- **Create Product modal updated:** removed Distributor product fields and standardized to `Other - Product Name`, `Other - Part Number`, and `Other - Product Description`.
- **UI-only removals shipped:** `Product Family - Vendor` and `Product Subtype - Vendor` are removed from UI surfaces (kept in DB/schema).
- **Backend filter behavior updated** so filtering for vendor identifiers also searches distributor values (to match the unified "Other" intent):
  - Opportunities: `accountIdVendor`, `customerIdVendor`
  - Revenue Schedules: `customerIdVendor`, `orderIdVendor`
- **Imports/mappings updated for compatibility:** Telarus reconciliation template mappings accept the new `Other - ...` labels (while keeping legacy mappings working).
- **Build validation:** `npm run build` passes with the above changes.
- **Optional “Other - Source” shipped:** added as a hidden-by-default column across list tables (Opportunities / Revenue Schedules / Tickets / Products / Reconciliation line items) and as a detail row in key detail panels (Opportunities Identifiers, Revenue Schedules Opportunity Details, Product detail, Opportunity Product detail).

### What we intentionally did (to reduce risk)

- **Phase 3 approach used:** Option **B** (reuse legacy *Vendor* column IDs internally, relabel to "Other", and remove/hide distributor-specific columns in UI where applicable). This minimizes preference migration work for the primary "Other" column.
- **Phase 3 compatibility layer added:** table preference aliasing maps legacy Distributor column IDs to the unified "Other" columns so saved column sets do not disappear after the UI removal.

### What is still pending / follow-ups

- **Phase 5 QA + rollout:** run the manual QA checklist across Opportunities / Revenue Schedules / Tickets / Products / Reconciliation, then plan rollout (feature flag if desired) + rollback notes.
- **CSV note:** `03.04.113` is not needed for this effort and can be ignored.

---

## Phase 4 Audit Results (non-Telarus mappings/templates/exports)

- **Codebase audit:** No non-Telarus, label-based mappings/templates/exports were found that depend on legacy `Vendor - ...` / `Distributor - ...` labels.
- **Telarus:** the Telarus reconciliation template supports both legacy labels and the new unified `Other - ...` labels.

## Removed UI Fields With No “Other” Replacement (UI-only removals)

These fields are intentionally removed from the UI (kept in DB/schema) and **do not** have an “Other” replacement:

- `Product Family - Vendor` (`productFamilyVendor`)
- `Product Subtype - Vendor` (`productSubtypeVendor`)
- `Distributor - Product Family` (`distributorProductFamily`)
- `Distributor - Product Subtype` (`distributorProductSubtype`)

## Phase 5 Manual QA Checklist (step-by-step)

### Opportunities

1. **List view:** open `Opportunities` and confirm only unified `Other - Account ID` / `Other - Customer ID` / `Other - Order ID` columns are available (no distributor-specific duplicates).
2. **Other - Source column:** open table column settings and enable `Other - Source` (should be hidden by default); confirm values show `Vendor` or `Distributor` when applicable.
3. **Search + filters:** verify searching/filtering by `Other - Account ID` / `Other - Customer ID` returns matches when the value exists in either Vendor or Distributor fields (Vendor-first display).
4. **Detail view:** open an Opportunity → `Identifiers` and confirm `Other - Source` appears and reflects Vendor-first precedence.
5. **Opportunity Product detail:** open an Opportunity Product line item detail and confirm only `Other - Product Name` / `Other - Part Number` / `Other - Product Description` are shown (no distributor duplicates) and `Other - Source` is present.

### Revenue Schedules

1. **List view:** open `Revenue Schedules` and enable `Other - Source` column (hidden by default); confirm it populates.
2. **Detail view:** open a Revenue Schedule → `Opportunity Details` and confirm `Other - Source` is present alongside the unified `Other - ...` identifiers.

### Tickets

1. **List view:** open `Tickets` and enable `Other - Source` column (hidden by default); confirm it populates and saved column sets still load (preference aliasing).

### Products

1. **List view:** open `Products` and enable `Other - Source` column (hidden by default); confirm it populates.
2. **Create Product modal:** confirm the modal no longer shows distributor product fields and only shows unified `Other - Product Name`, `Other - Part Number`, `Other - Product Description`.
3. **Product detail:** open a Product and confirm `Other - Source` is present in the “Other” section.

### Reconciliation

1. **Deposit detail:** open a Deposit → line items table and enable `Other - Source` column (hidden by default); confirm it populates and is filterable.
2. **CSV export:** export selected line items and confirm `Other - Source` appears as a column header with values.

### Preferences migration/aliasing (Phase 3 validation)

1. For each of the tables above, load any saved column preferences that previously included distributor column IDs (e.g. `customerIdDistributor`, `orderIdDistributor`, `productNameDistributor`).
2. Confirm the table still renders columns (they should map to the unified “Other” columns instead of disappearing).

## Goals

1. Replace specified Vendor/Distributor identifiers and product fields with a single **Other** field in the UI.
2. Standardize label format to `Other - <Field>`.
3. Keep existing DB columns and internal fields intact (no dropping/renaming DB columns in this effort).
4. Ensure imports/mappings remain functional by supporting both legacy and new labels where label-based mapping is used.

## Non-goals (for this phase)

- Renaming/dropping DB columns (Prisma fields like `customerIdVendor`, `customerIdDistributor`, etc remain).
- Changing reconciliation/matching behavior beyond label + "display field" selection.
- Unifying Vendor/Distributor names (e.g. `Vendor Name`, `Distributor Name`) unless explicitly requested later.

---

## Definitions

- **Other field:** A single field shown to users that represents the "non-house" party identifiers and attributes, derived from existing Vendor/Distributor fields.
- **Vendor-first precedence:** if both Vendor and Distributor values exist, show Vendor in the "Other" field; otherwise fallback to Distributor.

---

## Canonical "Other" Field Set

### Display labels (new standard)

| Other UI Label | Typical legacy sources (Vendor-first) |
|---|---|
| Other - Account ID | `accountIdVendor ?? accountIdDistributor` |
| Other - Customer ID | `customerIdVendor ?? customerIdDistributor` |
| Other - Order ID | `orderIdVendor ?? orderIdDistributor` |
| Other - Product Name | `productNameVendor ?? productNameDistributor` |
| Other - Part Number | `partNumberVendor ?? partNumberDistributor` |
| Other - Product Description | `productDescriptionVendor ?? productDescriptionDistributor` |

### Recommended supporting (optional) field

To reduce ambiguity and support support/debugging, add an optional hidden-by-default field:
- **Other - Source**: `Vendor` | `Distributor` | `--`

This is optional but strongly recommended if users need to understand which value they're seeing.

---

## Source-of-Truth Mapping From the CSV

The CSV enumerates the specific pages/Field IDs where Vendor/Distributor labels appear and the desired "Other" replacement label. It also includes items marked `NONE DELETE` (UI-only removal).

### CSV note (confirmed)

- The CSV row `03.04.113` (blank `Field_Name`) is **not needed** for this effort and can be ignored.

### "Other" renames called out by the CSV

The CSV "NEW FIELD" values are currently in the form `Account ID - Other`, etc. Implementation should follow the confirmed preferred label format:
- **Use:** `Other - Account ID` (not `Account ID - Other`)

### UI-only removals called out by the CSV

- `Product Family - Vendor` (`Product_Family_Vendor`) -> remove from UI
- `Product Subtype - Vendor` (`Product_Subtype_Vendor`) -> remove from UI

---

## Implementation Strategy (Phased)

### Phase 0 - Spec finalization + inventory (required)

1. Lock the canonical list of "Other" fields (table above).
2. Ignore `03.04.113` (blank `Field_Name`) since it is not needed for this effort.
3. Inventory all UI and API surfaces that currently render any of:
   - `Account ID - Vendor` / `Account ID - Distributor`
   - `Customer ID - Vendor` / `Customer ID - Distributor`
   - `Order ID - Vendor` / `Order ID - Distributor`
   - `Product Name - Vendor` / `Product Name - Distributor`
   - `Part Number - Vendor` / `Part Number - Distributor`
   - `Product Description - Vendor` / `Product Description - Distributor`

Deliverable: a clear "what changes where" checklist (appendix below provides the CSV-derived list).

### Phase 1 - Backend/API: add computed "Other" fields (non-breaking)

Add computed fields to API responses where vendor/distributor variants exist, without removing existing fields.

Guidelines:
- **Do not delete existing fields**; add additional `*Other` fields or computed accessors.
- Keep logic centralized (helpers/serializers) so precedence is consistent everywhere.

Suggested computed fields (examples; actual naming can follow existing DTO conventions):
- `accountIdOther`, `customerIdOther`, `orderIdOther`
- `productNameOther`, `partNumberOther`, `productDescriptionOther`
- `otherSource` (optional): `"Vendor" | "Distributor" | null`

Target entities likely needing coverage:
- Opportunities (list + detail + nested identifiers blocks)
- Revenue Schedules (list + detail + supporting details)
- Tickets (list)
- Products (list + detail + create/edit payload echoes, if relevant)
- Deposit/Reconciliation line items and "supporting details" (where vendor/distributor metadata is surfaced)

Deliverable: API responses include "Other" fields that the UI can consume with no ambiguity.

### Phase 2 - UI: switch to "Other - ..." fields and remove duplicates

1. Replace Vendor/Distributor ID fields in UI tables and detail panels with a single "Other - ..." field.
2. Ensure the UI does not show both vendor + distributor variants anywhere the "Other" field is adopted.
3. Standardize labels to `Other - <Field>`.

Key UI areas (non-exhaustive):
- Opportunity detail "Identifiers" display (currently shows both vendor and distributor IDs).
- List view column chooser definitions, filters, and export headers.
- Revenue schedule detail/supporting details panels that include vendor/distributor metadata.
- Deposit reconciliation filters/columns (where present).

UI-only removals:
- Remove `Product Family - Vendor` and `Product Subtype - Vendor` from:
  - product list columns
  - product detail view
  - product create/edit modals (if present)
  - opportunity product add forms (if present)

Deliverable: Users see "Other" fields only, and Product Family/Subtype vendor fields disappear from UI.

### Phase 3 - Preferences + backward compatibility (high priority)

Risk: dynamic table preferences store column IDs; if we introduce new "Other" column IDs, existing users may lose configured columns.

Mitigation options (pick one; recommended is A):

**A) Column ID alias/migration (recommended)**
- When hydrating table preferences, map legacy IDs to the new "Other" IDs.
- Example mappings:
  - `accountIdVendor` and `accountIdDistributor` -> `accountIdOther`
  - `customerIdVendor` and `customerIdDistributor` -> `customerIdOther`
  - `orderIdVendor` and `orderIdDistributor` -> `orderIdOther`

**B) Reuse legacy column IDs internally**
- Keep a single canonical legacy ID per "Other" column (e.g. keep `customerIdVendor` column ID, but relabel + compute vendor-first fallback).
- Hide/remove the distributor column.
- This minimizes preference migration but keeps internal naming "Vendor" for a user-visible "Other" column.

Deliverable: no user loses their selected columns after deployment; no duplicate "Other" columns appear.

### Phase 4 - Imports/mappings: support "Other - ..." labels (compat)

Where label-based mapping exists, add aliases so both legacy and new labels map correctly.

Known example:
- Telarus mapping uses Commissable field labels (`lib/deposit-import/telarus-template-master.ts`).

Required behavior:
- Accept legacy labels (`Vendor - Account ID`, `Distributor - Order ID`, etc) and new unified labels (`Other - Account ID`, `Other - Order ID`, etc).

Deliverable: existing vendor templates continue to map; future templates can use "Other" labels.

### Phase 5 - QA, rollout, and monitoring

**Validation (automated search)**
- Verify no remaining user-facing strings for replaced labels in UI surfaces that are in-scope.
- Verify no UI surfaces show both Vendor + Distributor variants when "Other" is intended.

**Manual checks**
- Opportunities: list columns, detail identifiers, exports.
- Revenue schedules: list/detail/supporting details.
- Tickets: list columns and exports.
- Products: list/detail/create (confirm family/subtype vendor fields removed from UI).
- Reconciliation: deposit line item filters/columns (confirm "Other" labels and values).

**Rollout**
- Prefer a feature flag if possible (to allow quick rollback of UI changes).
- Roll out to internal users first; validate against real records where vendor and distributor values differ.

**Rollback**
- Safe rollback path: revert UI to legacy rendering/labels (DB unchanged).
- If API adds new fields only: low risk; leaving them is acceptable even after rollback.

---

## Success Criteria (Acceptance)

1. For all in-scope pages/field IDs (appendix), Vendor + Distributor fields are replaced with a single "Other" field in the UI.
2. "Other" values follow Vendor-first precedence consistently across modules.
3. Labels consistently follow `Other - <Field>` format.
4. `Product Family - Vendor` and `Product Subtype - Vendor` are removed from the UI (but remain in DB/schema).
5. User table preferences do not break (either via migration/aliasing or by reusing legacy IDs).
6. Deposit import mapping continues to work for existing templates and supports "Other" labels going forward.

---

## Appendix A - CSV-derived change inventory (grouped by Field_Name)

### Account_ID_Vendor
- Old label(s): Account ID - Vendor
- CSV new field: Account ID - Other
- Field IDs: 02.06.006, 03.01.005, 04.05.001, 04.05.002, 06.04.000, 09.01.006
- Pages:
  - Contacts - 2-6-Contact Detail Page - Opportunities Tab
  - Opportunities-3-1-Detail Page - List of Opportunities
  - Reconciliation-6-4-Step 2 - Deposit Line Items Section - Step2 (Middle)
  - Revenue Schedules-4.5-Details (Opportunity Details)
  - Tickets-9-1-Main Page-List of Tickets

### Customer_ID_Distributor
- Old label(s): Customer ID - Distributor
- CSV new field: Customer ID - Other
- Field IDs: 04.00.020, 04.05.005
- Pages:
  - Revenue Schedules-4.0-List View - All Schedules
  - Revenue Schedules-4.5-Details (Opportunity Details)

### Customer_ID_Vendor
- Old label(s): Customer ID - Vendor
- CSV new field: Customer ID - Other
- Field IDs: 02.06.007, 03.01.006, 04.00.016, 04.05.004, 06.04.014, 09.01.007
- Pages:
  - Contacts - 2-6-Contact Detail Page - Opportunities Tab
  - Opportunities-3-1-Detail Page - List of Opportunities
  - Reconciliation-6-4-Step 2 - Deposit Line Items Section - Step2 (Middle)
  - Revenue Schedules-4.0-List View - All Schedules
  - Revenue Schedules-4.5-Details (Opportunity Details)
  - Tickets-9-1-Main Page-List of Tickets

### Order_ID_Distributor
- Old label(s): Order ID - Distributor
- CSV new field: Order ID - Other
- Field IDs: 04.00.021, 04.05.008
- Pages:
  - Revenue Schedules-4.0-List View - All Schedules
  - Revenue Schedules-4.5-Details (Opportunity Details)

### Order_ID_Vendor
- Old label(s): Order ID - Vendor
- CSV new field: Order ID - Other
- Field IDs: 02.06.009, 04.00.017, 04.05.007, 06.04.015, 09.01.010
- Pages:
  - Contacts - 2-6-Contact Detail Page - Opportunities Tab
  - Reconciliation-6-4-Step 2 - Deposit Line Items Section - Step2 (Middle)
  - Revenue Schedules-4.0-List View - All Schedules
  - Revenue Schedules-4.5-Details (Opportunity Details)
  - Tickets-9-1-Main Page-List of Tickets

### Part_Number_Vendor
- Old label(s): Part Number - Vendor
- CSV new field: Part Number - Other
- Field IDs: 03.03.002, 05.01.006, 05.04.006
- Pages:
  - Opportunities-3-3-Opportunity - Detail Page - Tab - Products
  - Products - 5-1-Create New Product Popup
  - Products - 5-2-Product Detail Page

### Product_Description_Vendor
- Old label(s): Product Description - Vendor
- CSV new field: Product Description - Other
- Field IDs: 03.04.115, 04.01.003, 05.01.007, 05.04.007
- Pages:
  - Opportunities-3-4.1-Opportunity - Detail Page - Tab - Products - Add New Product to Catalog + Opp Page
  - Products - 5-1-Create New Product Popup
  - Products - 5-2-Product Detail Page
  - Revenue Schedules-4.1-Details (Default View) - Common Top Section

### Product_Family_Vendor
- Old label(s): Product Family - Vendor
- CSV new field: NONE DELETE
- Field IDs: 03.04.002, 03.04.112, 03.06.002, 05.00.003, 05.01.003, 05.04.003
- Pages:
  - Opportunities-3-4.1-Opportunity - Detail Page - Tab - Products - Add New Product to Catalog + Opp Page
  - Opportunities-3-4-Opportunity - Detail Page - Tab - Products - Add Existing Product to Opp Page
  - Opportunities-3-6-Main Page-Create New Revenue Schedule  (Left Column)
  - Products - 5-0-Main List of Products Page
  - Products - 5-1-Create New Product Popup
  - Products - 5-2-Product Detail Page

### Product_Name_Vendor
- Old label(s): Product Name - Vendor
- CSV new field: Product Name - Other
- Field IDs: 03.03.001, 03.04.003, 03.04.114, 03.05.005, 03.06.004, 04.00.003, 04.01.002, 04.06.106, 05.00.005, 05.01.005, 05.04.005, 06.04.006, 06.05.004, 06.06.004, 06.07.017, 09.01.005
- Pages:
  - Opportunities-3-3-Opportunity - Detail Page - Tab - Products
  - Opportunities-3-4.1-Opportunity - Detail Page - Tab - Products - Add New Product to Catalog + Opp Page
  - Opportunities-3-4-Opportunity - Detail Page - Tab - Products - Add Existing Product to Opp Page
  - Opportunities-3-5-Opportunity - Detail Page - Tab - Revenue Schedules
  - Opportunities-3-6-Main Page-Create New Revenue Schedule  (Left Column)
  - Products - 5-0-Main List of Products Page
  - Products - 5-1-Create New Product Popup
  - Products - 5-2-Product Detail Page
  - Reconciliation-6-4-Step 2 - Deposit Line Items Section - Step2 (Middle)
  - Reconciliation-6-5-Step 2-Revenue Schedule Suggested  (Bottom)
  - Reconciliation-6-6-Create a Flex Product Popup Page
  - Reports-8-4-Sample Report-Individual Deposit Detail Page - Summary (BOTTOM)
  - Revenue Schedules-4.0-List View - All Schedules
  - Revenue Schedules-4.1-Details (Default View) - Common Top Section
  - Revenue Schedules-4.6-Tickets-9-2-Create New Ticket
  - Tickets-9-1-Main Page-List of Tickets

### Product_Subtype_Vendor
- Old label(s): Product Subtype - Vendor
- CSV new field: NONE DELETE
- Field IDs: 03.06.003, 05.00.004, 05.01.004, 05.04.004
- Pages:
  - Opportunities-3-6-Main Page-Create New Revenue Schedule  (Left Column)
  - Products - 5-0-Main List of Products Page
  - Products - 5-1-Create New Product Popup
  - Products - 5-2-Product Detail Page
