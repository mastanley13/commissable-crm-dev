# Deposit System — Complete Reference

Last updated: 2026-02-19
Scope: End-to-end deposit lifecycle — upload, field mapping, templates, matching, allocation, reconciliation, finalization, and the flex system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Models](#2-database-models)
3. [File Upload & Parsing](#3-file-upload--parsing)
4. [Upload Wizard (UI)](#4-upload-wizard-ui)
5. [Field Mapping System](#5-field-mapping-system)
6. [Reconciliation Templates](#6-reconciliation-templates)
7. [Multi-Vendor Uploads](#7-multi-vendor-uploads)
8. [Import Processing (Backend)](#8-import-processing-backend)
9. [Matching Engine](#9-matching-engine)
10. [Allocation & Aggregates](#10-allocation--aggregates)
11. [Match Groups & Manual Matching](#11-match-groups--manual-matching)
12. [Flex System (Overpayments & Chargebacks)](#12-flex-system-overpayments--chargebacks)
13. [Finalization & Unfinalization](#13-finalization--unfinalization)
14. [Deposit Deletion](#14-deposit-deletion)
15. [Bundle Rip-Replace on Deposits](#15-bundle-rip-replace-on-deposits)
16. [Verification](#16-verification)
17. [API Reference](#17-api-reference)
18. [UI Pages & Components](#18-ui-pages--components)
19. [Key Library Files](#19-key-library-files)
20. [Environment Variables](#20-environment-variables)
21. [Troubleshooting](#21-troubleshooting)

---

## 1. System Overview

The deposit system handles the full lifecycle of commission deposit data — from importing raw distributor files through matching against revenue schedules to final reconciliation.

**End-to-end flow:**

```
Upload File ──► Parse ──► Map Columns ──► Create Deposit + Line Items
                                                    │
                                                    ▼
                                          Auto-Match / Manual Match
                                                    │
                                                    ▼
                                          Review & Resolve Variances
                                                    │
                                                    ▼
                                              Finalize Deposit
                                                    │
                                                    ▼
                                       Revenue Schedules Reconciled
```

**Key concepts:**

- **Deposit** — A batch of imported rows from one file, tied to a specific Distributor and Vendor (or one Deposit per Vendor in multi-vendor mode).
- **Deposit Line Item** — A single imported row containing at least a Usage or Commission value.
- **Field Mapping** — Rules that map file column headers to Commissable's canonical fields.
- **Reconciliation Template** — A saved mapping configuration for a (Distributor, Vendor) pair, reusable across uploads.
- **Match** — A link between a Deposit Line Item and a Revenue Schedule, with allocated Usage and Commission amounts.
- **Match Group** — A container for related matches applied together (supports 1:1, 1:N, N:1, N:M cardinalities).
- **Flex** — A system for handling overpayments, underpayments, and chargebacks during matching.
- **Finalization** — The act of locking a deposit and applying all matches to revenue schedules permanently.

---

## 2. Database Models

All models live in `prisma/schema.prisma`.

### 2.1 Deposit

The top-level record for an uploaded deposit batch.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `tenantId` | String | Multi-tenant isolation |
| `accountId` | String | FK → Account (legacy, may duplicate distributor) |
| `distributorAccountId` | String | FK → Account (the distributor) |
| `vendorAccountId` | String? | FK → Account (the vendor; null for multi-vendor) |
| `month` | DateTime | Commission period (1st of month) |
| `depositName` | String? | User-provided or auto-generated name |
| `paymentDate` | DateTime? | Payment date from file or form |
| `paymentType` | DepositPaymentType? | ACH, Wire, Check, CreditCard, Other |
| `status` | ReconciliationStatus | Pending, InReview, Completed, Disputed |
| `reconciled` | Boolean | Whether fully finalized |
| `reconciledAt` | DateTime? | When finalization occurred |
| `totalRevenue` | Decimal? | Total revenue |
| `totalCommissions` | Decimal? | Sum of all line item commissions |
| `totalItems` | Int | Count of line items |
| `totalReconciledItems` | Int | Count of reconciled line items |
| `totalUsage` | Decimal? | Sum of all line item usage |
| `usageAllocated` | Decimal? | Usage allocated to matches |
| `usageUnallocated` | Decimal? | Usage not yet allocated |
| `commissionAllocated` | Decimal? | Commission allocated to matches |
| `commissionUnallocated` | Decimal? | Commission not yet allocated |
| `itemsReconciled` | Int | Items reconciled count |
| `itemsUnreconciled` | Int | Items unreconciled count |
| `actualReceivedAmount` | Decimal? | Verified received amount (from verification step) |
| `receivedDate` | DateTime? | Date payment was received |
| `receivedBy` | String? | Person who received payment |
| `reconciliationTemplateId` | String? | FK → ReconciliationTemplate used |
| `createdByUserId` | String? | FK → User who uploaded |
| `createdByContactId` | String? | FK → Contact who uploaded |
| `notes` | String? | Free-text notes |

**Relations:** `lineItems[]`, `matchGroups[]`, `account`, `distributor`, `vendor`, `reconciliationTemplate`, `createdByUser`, `createdByContact`

### 2.2 DepositLineItem

Individual rows from the uploaded file.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `tenantId` | String | Multi-tenant isolation |
| `depositId` | String | FK → Deposit |
| `lineNumber` | Int | Row number from file (1-indexed) |
| `status` | DepositLineItemStatus | Unmatched, Suggested, Matched, PartiallyMatched, Ignored |
| `primaryRevenueScheduleId` | String? | FK → RevenueSchedule (highest-weight match) |
| **Resolved FKs** | | |
| `accountId` | String? | Resolved customer Account FK |
| `vendorAccountId` | String? | Resolved vendor Account FK |
| `productId` | String? | Resolved Product FK |
| **Raw fields from file** | | |
| `accountNameRaw` | String? | Account name as it appeared in file |
| `vendorNameRaw` | String? | Vendor name as it appeared in file |
| `productNameRaw` | String? | Product name as it appeared in file |
| `partNumberRaw` | String? | Part number as it appeared in file |
| `distributorNameRaw` | String? | Distributor name as it appeared in file |
| `accountIdVendor` | String? | Vendor's account ID from file |
| `customerIdVendor` | String? | Vendor's customer ID from file |
| `orderIdVendor` | String? | Vendor's order ID from file |
| `locationId` | String? | Location identifier |
| `customerPurchaseOrder` | String? | Customer PO number |
| **Financial fields** | | |
| `usage` | Decimal? | Usage/revenue amount |
| `usageAllocated` | Decimal? | Usage allocated to matches |
| `usageUnallocated` | Decimal? | Usage not yet allocated |
| `commission` | Decimal? | Commission amount |
| `commissionAllocated` | Decimal? | Commission allocated to matches |
| `commissionUnallocated` | Decimal? | Commission not yet allocated |
| `commissionRate` | Decimal? | Commission rate (fraction, e.g., 0.10) |
| **Other** | | |
| `paymentDate` | DateTime? | Per-line payment date |
| `isChargeback` | Boolean | Whether this is a negative/chargeback line |
| `reconciled` | Boolean | Whether finalized |
| `hasSuggestedMatches` | Boolean | Whether AI suggestions exist |
| `lastMatchCheckAt` | DateTime? | Last time matching was run |
| `metadata` | Json? | Extensible: custom fields, opportunity data, matching signals |

**Relations:** `deposit`, `account`, `vendorAccount`, `product`, `primaryRevenueSchedule`, `matches[]`

### 2.3 DepositLineMatch

A match between a line item and a revenue schedule with allocated amounts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `tenantId` | String | Multi-tenant isolation |
| `depositLineItemId` | String | FK → DepositLineItem |
| `revenueScheduleId` | String | FK → RevenueSchedule |
| `matchGroupId` | String? | FK → DepositMatchGroup |
| `usageAmount` | Decimal? | Usage allocated in this match |
| `commissionAmount` | Decimal? | Commission allocated in this match |
| `confidenceScore` | Float? | Matching confidence (0.0–1.0) |
| `status` | DepositLineMatchStatus | Suggested, Applied, Rejected |
| `source` | DepositLineMatchSource? | Auto, Manual |
| `explanation` | Json? | Matching signals/reasons |
| `reconciled` | Boolean | Whether finalized |

**Unique constraint:** `[depositLineItemId, revenueScheduleId]` — one match per line-schedule pair.

### 2.4 DepositMatchGroup

Groups matches that were applied together (e.g., for N:M matching).

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `tenantId` | String | Multi-tenant isolation |
| `depositId` | String | FK → Deposit |
| `matchType` | DepositMatchType | OneToOne, OneToMany, ManyToOne, ManyToMany |
| `status` | DepositMatchGroupStatus | Applied, Undone |
| `createdByUserId` | String? | User who created the match |
| `undoneAt` | DateTime? | When the match group was undone |
| `undoneByUserId` | String? | Who undid it |
| `undoReason` | String? | Reason for undo |

### 2.5 ReconciliationTemplate

Stores reusable column-mapping configurations.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `tenantId` | String | Multi-tenant isolation |
| `name` | String | Template name |
| `description` | String? | Description |
| `distributorAccountId` | String | FK → distributor Account |
| `vendorAccountId` | String | FK → vendor Account |
| `config` | Json? | The V2 mapping configuration |
| `createdByUserId` | String? | Creator user |
| `createdByContactId` | String? | Creator contact |

**Unique constraint:** `[tenantId, distributorAccountId, vendorAccountId, name]`

### 2.6 Enums

| Enum | Values |
|------|--------|
| `ReconciliationStatus` | Pending, InReview, Completed, Disputed |
| `DepositPaymentType` | ACH, Wire, Check, CreditCard, Other |
| `DepositLineItemStatus` | Unmatched, Suggested, Matched, PartiallyMatched, Ignored |
| `DepositLineMatchStatus` | Suggested, Applied, Rejected |
| `DepositLineMatchSource` | Auto, Manual |
| `DepositMatchType` | OneToOne, OneToMany, ManyToOne, ManyToMany |
| `DepositMatchGroupStatus` | Applied, Undone |

---

## 3. File Upload & Parsing

**File:** `lib/deposit-import/parse-file.ts`

The `parseSpreadsheetFile()` function accepts a file and returns `{ headers: string[], rows: string[][] }`.

### Supported formats

**CSV** (via PapaParse):
- Parses with `skipEmptyLines: "greedy"`
- First row → headers
- Remaining non-empty rows → data

**Excel** (.xls, .xlsx via XLSX library):
- Reads the first sheet only
- Uses `sheet_to_json` in array-of-arrays mode with `blankrows: false`
- First row → headers

**PDF** (via pdfjs-dist):
- Extracts text fragments with (x, y) coordinates from each page
- Groups fragments into lines by Y-coordinate tolerance (2 units)
- Splits lines into cells using gap detection:
  - Gap threshold = `max(24, median(gaps) * 3)` or 24 if fewer than 4 gaps
- Identifies header row as first line with ≥ 2 cells
- Maps data rows to columns using boundary positions (midpoints between header cell starts)
- Filters out empty rows and duplicate header rows
- Fails gracefully for password-protected or scanned/image-only PDFs

### Value normalization

**File:** `app/api/reconciliation/deposits/import/route.ts` (inline helpers)

| Data type | Function | Behavior |
|-----------|----------|----------|
| Number | `normalizeNumber()` | Strips `$`, `,`, and non-numeric chars except `.` and `-`; returns `Number` or `null` |
| String | `normalizeString()` | Trims whitespace; empty → `null` |
| Date | `parseDateValue()` | Handles ISO strings; detects Excel serial date numbers (range 20000–60000, epoch 1899-12-30) |
| Boolean | `parseBoolean()` | `"true"/"yes"/"1"/"y"` → `true`; `"false"/"no"/"0"/"n"` → `false` |

### Header resolution

**File:** `lib/deposit-import/resolve-header.ts`

When a mapping says "use column X", the server resolves the header by trying (in order):

1. Exact match
2. Trimmed match
3. Case-insensitive trimmed match
4. Normalized-key match

If two columns normalize to the same key → **ambiguous column error** (user must fix headers).

---

## 4. Upload Wizard (UI)

The upload wizard is a multi-step flow accessible from the Reconciliation / Deposits page.

**Route:** `/reconciliation/deposit-upload-list`

### Step 1 — Create Deposit

**Component:** `components/deposit-upload/create-template-step.tsx`

The user provides:

| Field | Required | Notes |
|-------|----------|-------|
| Distributor | Yes | Searchable account dropdown |
| Vendor | Conditional | Required unless Multi-Vendor is on; searchable dropdown |
| Multi-Vendor toggle | No | Disables vendor picker; enables per-row vendor resolution |
| Commission Period | Yes | `YYYY-MM` picker |
| Deposit Received Date | Yes | `YYYY-MM-DD` picker |
| Deposit Name | Auto | Read-only; generated from selections |
| Created By | Auto | Populated from logged-in user's contacts |
| File | Yes | Accepts `.csv`, `.xlsx`, `.xls`, `.pdf` |
| Template | Optional | Dropdown of existing templates for the selected distributor/vendor |

When Multi-Vendor is toggled on:
- Vendor picker is disabled
- Template selection is cleared (templates are resolved per-vendor during import)
- Summary/totals rows are automatically skipped during import

### Step 2 — Map Fields

**Component:** `components/deposit-upload/map-fields-step.tsx`

After a file is selected, the UI:

1. Parses the file to detect headers and sample rows
2. Loads the **Field Catalog** from `GET /api/reconciliation/deposits/import-field-catalog`
3. Seeds the mapping from the selected template (if any)
4. Runs auto-mapping using header synonym matching

The mapping interface organizes columns into three tabs:

| Tab | Contents |
|-----|----------|
| **Template Fields** | Columns with template-driven or auto-suggested mappings |
| **New Fields** | Columns not in the template that have values and a reasonable suggestion |
| **Exclude** | Columns explicitly set to "Do Not Map", empty columns, or unrecognized columns |

Each column can be set to:
- **Map to a target field** — e.g., `Total Bill` → `Actual Usage`
- **Create a Custom Field** — stores the value in `metadata.custom[key]` with a user-defined label
- **Additional info** — kept as informational, not mapped to a standard target
- **Do Not Map** — explicitly excluded

**Blocking validation:**
- At least one of **Actual Usage** or **Actual Commission** must be mapped
- If Multi-Vendor is enabled, **Vendor Name** must be mapped

**Features:**
- Undo support (short history of mapping states)
- "Save mapping updates" checkbox to persist mapping changes back to the template
- Sample data preview for each column
- Status badges (Mapped / Unmapped / Excluded)

### Step 3 — Review

**Component:** `components/deposit-upload/review-step.tsx`

Displays:
- Count of detected columns and mapped fields
- List of mapped vs. unmapped/excluded columns with sample data
- Validation issues (if any)
- **Import** button (blocked if validation fails)

### Step 4 — Confirm (optional)

**Component:** `components/deposit-upload/confirm-step.tsx`

Shows row count, mapped field count, and a final confirmation button.

---

## 5. Field Mapping System

### 5.1 Field Catalog

**File:** `lib/deposit-import/field-catalog.ts`

The field catalog defines all canonical fields that file columns can be mapped to. Each field target has:

```typescript
interface DepositImportFieldTarget {
  id: string              // e.g., "depositLineItem.usage"
  label: string           // Human-readable label
  entity: "depositLineItem" | "deposit" | "opportunity" | "product" | "matching"
  dataType: "string" | "number" | "date" | "boolean"
  persistence: "depositLineItemColumn" | "depositColumn" | "metadata"
  columnName?: string     // DB column name (for direct-column persistence)
  metadataPath?: string[] // JSON path (for metadata persistence)
  required?: boolean
}
```

### 5.2 Available target fields

#### Deposit Line Item fields (persist to DB columns)

| Target ID | Label | Column | Type |
|-----------|-------|--------|------|
| `depositLineItem.lineNumber` | Line Number | `lineNumber` | number |
| `depositLineItem.paymentDate` | Payment Date | `paymentDate` | date |
| `depositLineItem.accountNameRaw` | Account Legal Name | `accountNameRaw` | string |
| `depositLineItem.accountIdVendor` | Other - Account ID | `accountIdVendor` | string |
| `depositLineItem.customerIdVendor` | Other - Customer ID | `customerIdVendor` | string |
| `depositLineItem.orderIdVendor` | Other - Order ID | `orderIdVendor` | string |
| `depositLineItem.productNameRaw` | Other - Product Name | `productNameRaw` | string |
| `depositLineItem.partNumberRaw` | Other - Part Number | `partNumberRaw` | string |
| `depositLineItem.usage` | Actual Usage | `usage` | number |
| `depositLineItem.commission` | Actual Commission | `commission` | number |
| `depositLineItem.commissionRate` | Actual Commission Rate % | `commissionRate` | number |
| `depositLineItem.locationId` | Location ID | `locationId` | string |
| `depositLineItem.customerPurchaseOrder` | Customer PO # | `customerPurchaseOrder` | string |
| `depositLineItem.vendorNameRaw` | Vendor Name | `vendorNameRaw` | string |
| `depositLineItem.distributorNameRaw` | Distributor Name | `distributorNameRaw` | string |

#### Deposit Line Item metadata fields (persist to `metadata` JSON)

| Target ID | Label | Metadata path | Type |
|-----------|-------|---------------|------|
| `depositLineItem.commissionDate` | Commission Date | `metadata.depositLineItem.commissionDate` | date |
| `depositLineItem.commissionType` | Commission Type | `metadata.depositLineItem.commissionType` | string |

#### Deposit-level fields (persist to Deposit record)

| Target ID | Label | Column | Type |
|-----------|-------|--------|------|
| `deposit.depositName` | Deposit Name | `depositName` | string |
| `deposit.paymentDate` | Payment Date | `paymentDate` | date |

#### Matching fields (persist to `metadata`)

| Target ID | Label | Metadata path | Type |
|-----------|-------|---------------|------|
| `matching.externalScheduleId` | External Schedule ID | `metadata.matching.externalScheduleId` | string |

#### Opportunity metadata fields (persist to `metadata`)

| Target ID | Label | Type |
|-----------|-------|------|
| `opportunity.name` | Opportunity Name | string |
| `opportunity.stage` | Stage | string |
| `opportunity.status` | Status | string |
| `opportunity.type` | Type | string |
| `opportunity.amount` | Amount | number |
| `opportunity.expectedCommission` | Expected Commission | number |
| `opportunity.estimatedCloseDate` | Estimated Close Date | date |
| `opportunity.actualCloseDate` | Actual Close Date | date |
| `opportunity.orderIdVendor` | Order ID (Vendor) | string |
| `opportunity.accountIdVendor` | Account ID (Vendor) | string |
| `opportunity.customerIdVendor` | Customer ID (Vendor) | string |
| `opportunity.customerPurchaseOrder` | Customer PO | string |
| `opportunity.locationId` | Location ID | string |

Plus **tenant-specific custom opportunity fields** from the `FieldDefinition` table.

#### Custom fields

Users can create custom fields during mapping. These store in `metadata.custom[customKey]` with a `{ label, section, value }` structure.

### 5.3 Where mapped data lands

| Persistence type | Storage location | Example |
|-----------------|------------------|---------|
| `depositLineItemColumn` | Direct column on `DepositLineItem` | `accountNameRaw`, `usage`, `commission` |
| `depositColumn` | Column on `Deposit` record | `depositName`, `paymentDate` |
| `metadata` | JSON blob on `DepositLineItem.metadata` | `metadata.matching.externalScheduleId` |
| Custom field | JSON blob at `metadata.custom[key]` | `metadata.custom.myField.value` |

### 5.4 Auto-mapping / synonym matching

**File:** `lib/deposit-import/field-suggestions.ts`

When the mapping step loads, the system attempts to auto-map file headers to target fields using:
- Header normalization (lowercase, strip whitespace/punctuation)
- A synonym table (e.g., `"Total Commission"` → `depositLineItem.commission`)
- Rate-column detection (headers with `%` or `rate` are de-prioritized for Usage/Commission)

### 5.5 Mapping config format (V2)

**File:** `lib/deposit-import/template-mapping-v2.ts`

```typescript
interface DepositMappingConfigV2 {
  version: 2
  targets: Record<string, string>       // targetId → columnName
  columns: Record<string, {             // columnName → config
    mode: "target" | "custom" | "exclude"
    targetId?: string                   // if mode is "target"
    customKey?: string                  // if mode is "custom"
  }>
  customFields: Record<string, {        // customKey → definition
    label: string
    section: "additional" | "product"
  }>
  header?: { row?: number }
  options?: Record<string, unknown>
}
```

**Key functions:**
- `seedDepositMappingV2()` — initializes mapping from template + auto-mapping
- `applyAutoMappingV2()` — auto-maps headers using synonym matching
- `getColumnSelectionV2()` / `setColumnSelectionV2()` — get/set individual column mappings
- `createCustomFieldForColumnV2()` — creates a custom field mapping for a column
- `convertDepositMappingV1ToV2()` — converts legacy V1 configs to V2

**Legacy support:** A `LEGACY_FIELD_ID_TO_TARGET_ID` map converts old short field IDs (e.g., `"usage"`, `"accountName"`) to the new fully-qualified target IDs.

---

## 6. Reconciliation Templates

### What a template stores

Templates are `ReconciliationTemplate` records keyed by `(tenantId, distributorAccountId, vendorAccountId, name)`.

The `config` JSON contains:
- `depositMapping` — the V2 mapping configuration
- Optional Telarus metadata (template IDs, origin, map name) when seeded from Telarus

### How templates are created

1. **Explicitly** — via `POST /api/reconciliation/templates`
2. **Implicitly** — by enabling "Save mapping updates" during import
3. **Auto-seeded** — for Telarus distributors, when listing templates and none exist for a distributor/vendor pair

### Template selection during upload

- When exactly **one** template exists for the selected distributor/vendor, it is auto-selected
- If **multiple** templates exist, the UI presents a dropdown
- Template mappings **seed** the initial mapping state but can be modified before import

### Telarus auto-seeding

**Files:** `lib/deposit-import/telarus-template-master.ts`, `lib/deposit-import/telarus-template-fields.ts`

When `GET /api/reconciliation/templates` is called and no templates exist for a distributor/vendor pair, the server checks against `docs/reference-data/telarus-vendor-map-fields-master.csv`. If a unique match is found, a seeded template is created with pre-built field mappings.

### Updating templates

When "Save mapping updates" is enabled during import, the server writes the current mapping config back into the template. This affects **future uploads only** — existing deposits are unchanged.

Templates can also be edited via `PATCH /api/reconciliation/templates/:templateId`.

---

## 7. Multi-Vendor Uploads

When Multi-Vendor mode is enabled, a single file containing rows from multiple vendors is split into multiple Deposits (one per vendor).

### How it works

1. The mapping must include **Vendor Name** (`depositLineItem.vendorNameRaw`).

2. **Row grouping** (`lib/deposit-import/multi-vendor-template-resolver.ts`):
   - Each row's vendor name is read from the mapped column
   - Rows are grouped by vendor name (case-insensitive)
   - Summary/totals rows are skipped (see below)

3. **Vendor resolution** — for each unique vendor name:
   - Looks up `Account` records where `accountName` or `accountLegalName` matches (case-insensitive exact match)
   - Resolves only if exactly one match is found
   - If no match → error listing unresolved vendors

4. **Template resolution** — for each resolved vendor:
   - Looks up `ReconciliationTemplate` for `(distributorId, vendorAccountId)`
   - If no template → error listing vendors missing templates
   - Templates are merged via `mergeMultiVendorTemplateConfigs()` (first-writer-wins for conflicts)

5. **Deposit creation** — one Deposit per vendor with auto-generated name: `"{VendorName} - {DistributorName} - {Date}"`

6. **Result:** Returns `depositIds[]` (one per vendor)

### Summary row skipping

**File:** `lib/deposit-import/multi-vendor.ts`

Controlled by `DEPOSIT_IMPORT_SKIP_SUMMARY_ROWS` env var (`"1"`, `"true"`, `"yes"`, `"on"`).

Rows are skipped if:
- The entire row is blank
- The vendor name matches a totals pattern (`Total`, `Totals`, `Grand Total`, `Sub-total`, `Subtotal`)
- Any cell (≤ 32 chars) matches a totals pattern

Pattern: `/^(?:grand\s+)?totals?$|^sub[- ]?totals?$/i`

### Common failure modes

- **Vendor names don't match** — file says "Acme Corp" but CRM has "Acme Corporation"
- **Missing templates** — templates exist for some vendors but not all
- **Vendor Name not mapped** — the multi-vendor column isn't mapped in the field mapping step

---

## 8. Import Processing (Backend)

**File:** `app/api/reconciliation/deposits/import/route.ts`

### Request format

`POST /api/reconciliation/deposits/import` (FormData)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | CSV, Excel, or PDF file |
| `distributorAccountId` | string | Yes | Distributor account UUID |
| `vendorAccountId` | string | Conditional | Required for single-vendor |
| `mapping` | string (JSON) | Yes | V2 mapping configuration |
| `commissionPeriod` | string | No | `"YYYY-MM"` |
| `paymentDate` | string | No | `"YYYY-MM-DD"` (defaults to today) |
| `depositName` | string | No | Deposit name |
| `reconciliationTemplateId` | string | No | Template UUID |
| `saveTemplateMapping` | string | No | `"true"` to persist mapping to template |
| `multiVendor` | string | No | `"true"` to enable multi-vendor mode |
| `idempotencyKey` | string | No | Prevents duplicate imports |
| `createdByContactId` | string | No | Contact UUID |

### Processing steps

1. **Auth check** — requires `reconciliation.manage` or `reconciliation.view` permissions
2. **Parse mapping** — validates V2 config; ensures Usage or Commission mapped; validates all target IDs against field catalog
3. **Idempotency check** — if key provided, returns existing result for duplicate submissions
4. **Parse file** — calls `parseSpreadsheetFile()`
5. **Build column index** — resolves header names to column indices
6. **Extract deposit-level overrides** — if Deposit Name or Payment Date are mapped to file columns, reads first non-empty value
7. **Create Deposit record** with metadata from the form
8. **Iterate rows**, for each valid row:
   - Extract Usage and Commission (skip rows where both are empty)
   - **Commission-only handling:** if Usage is null but Commission exists → `usage = commission`, `commissionRate = 1.0`
   - Extract and parse all mapped fields by type
   - Store `depositLineItemColumn` fields as direct columns
   - Store `metadata` fields as nested JSON paths
   - Store custom fields in `metadata.custom[key]`
9. **Bulk create** all line items via `createMany`
10. **Update deposit aggregates** (totals, counts)
11. **Create ImportJob** record with status `Completed`
12. **Optionally save** template mapping config

### Response

Single-vendor:
```json
{
  "depositId": "...",
  "importJobId": "...",
  "totalItems": 150,
  "parseTimeMs": 234,
  "transactionTimeMs": 890,
  "totalTimeMs": 1124
}
```

Multi-vendor:
```json
{
  "depositIds": ["...", "..."],
  "depositsCreated": 3,
  "processedRows": 450
}
```

---

## 9. Matching Engine

**File:** `lib/matching/deposit-matcher.ts`

The matching engine finds and scores candidate Revenue Schedules for each Deposit Line Item.

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_RESULT_LIMIT` | 5 | Max candidates returned per line |
| `DEFAULT_UNIVERSE_LIMIT` | 30 | Min search pool size |
| `DEFAULT_DATE_WINDOW_MONTHS` | 1 | Months before/after to search |
| `DEFAULT_VARIANCE_TOLERANCE` | 0 | Exact match required by default |
| `CROSS_VENDOR_CONFIDENCE_CAP` | 0.6 | Max confidence for cross-vendor fallback |
| `PASS_B_MIN_CONFIDENCE` | 0.5 | Minimum for fuzzy matches |
| Auto-match threshold | 0.97 | Auto-apply if confidence ≥ this |
| Suggest threshold | 0.90 | "High" confidence label |
| Medium threshold | 0.75 | "Medium" confidence label |

### Core function: `matchDepositLine(depositLineItemId, options)`

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `limit` | 5 | Max candidates |
| `dateWindowMonths` | 1 | Date search window |
| `includeFutureSchedules` | false | Search future dates |
| `useHierarchicalMatching` | env-based | Use hierarchical vs. legacy scoring |
| `varianceTolerance` | 0 | Amount variance tolerance |
| `allowCrossVendorFallback` | false | Fall back to cross-vendor search |
| `debugLog` | env-based | Enable debug logging |

**Process:**

1. Fetch deposit line item with all relations
2. Fetch candidate revenue schedules (filtered by date window, status, distributor, vendor, account)
3. Score candidates using either hierarchical or legacy scoring
4. Inject any previously-applied matches not in candidate set (confidence = 1.0)
5. Sort and return top results

### Candidate fetching

Revenue schedules are eligible if:
- Within date range: `referenceDate ± dateWindowMonths`
- Status is `Unreconciled`, `Underpaid`, or `Overpaid`
- Match on `tenantId`, and optionally `distributorAccountId`, `vendorAccountId`, `accountId`
- Have `commissionDifference > 0` (still expecting payment)

If no results and `allowCrossVendorFallback` is enabled, re-queries without vendor/distributor/account filters.

If line item has no `accountId` but has `accountNameRaw`, attempts to resolve by matching against `accountLegalName` or `accountName` (case-insensitive, requires exactly 1 match).

### Legacy scoring

Weighted signal-based scoring:

| Signal | Weight | Type | Description |
|--------|--------|------|-------------|
| `vendor_account_exact` | 0.18 | Boolean | Vendor account ID matches |
| `account_exact` | 0.22 | Boolean | Customer account ID matches |
| `customer_id_exact` | 0.12 | Boolean | Customer/vendor ID matches (multi-value) |
| `order_id_exact` | 0.12 | Boolean | Order ID matches (multi-value) |
| `account_name_similarity` | 0.12 | Similarity | Account/distributor name token-based Jaccard similarity |
| `product_similarity` | 0.08 | Similarity | Best product name similarity across multiple fields |
| `usage_amount` | 0.08 | Similarity | Usage amount proximity |
| `commission_amount` | 0.05 | Similarity | Commission amount proximity |
| `date_proximity` | 0.03 | Similarity | Linear decay over 90 days |

**Total weight = 1.00.** Score = Σ(signal_score × weight), capped at 1.0.

### Hierarchical scoring

Two-pass approach:

**Pass A — Exact Match:**
- Requires at least ONE strong ID match:
  - `account_legal_exact` — account legal name exact match
  - `order_id_exact` — order ID overlap (multi-value)
  - `customer_id_exact` — customer ID overlap (multi-value)
  - `account_id_exact` — vendor account ID match
  - `location_or_po_exact` — location ID or PO number match
  - `external_schedule_id_exact` — external schedule ID match
- Also requires amount and date scores ≥ `(1 - varianceTolerance)`
- Cross-vendor candidates excluded from Pass A
- If all conditions met → confidence = **1.0**, matchType = `"exact"`

**Pass B — Fuzzy Match:**
- Blocked if `hasStrongIdConflict()` returns true:
  - Order IDs exist on both sides but don't overlap
  - Account IDs exist on both sides but differ
  - Location IDs exist on both sides but don't overlap
  - PO numbers exist on both sides but don't overlap
  - (Customer IDs are NOT checked for conflicts — only as positive signal)

| Signal | Weight | Description |
|--------|--------|-------------|
| `account_name_similarity` | 0.4 | Account name similarity |
| `product_identity` | 0.3 | Product name + part number + description similarity |
| `amount_proximity` | 0.2 | Best of usage and commission proximity |
| `date_proximity` | 0.1 | Date proximity |

- Min confidence: 0.5
- Cross-vendor candidates capped at 0.6

**Combined:** Pass A + Pass B (excluding duplicates), sorted by confidence desc → scheduleDate asc → createdAt asc.

### Similarity functions

| Function | Algorithm |
|----------|-----------|
| `computeNameSimilarity(a, b)` | Normalize (uppercase, strip LLC/INC/CORP/LTD suffixes), tokenize, Jaccard-style overlap: `intersection / max(\|A\|, \|B\|)` |
| `computeProductIdentitySimilarity()` | Best of: product name similarity, part number similarity, description similarity |
| `amountProximity(a, b)` | `1 - \|a - b\| / max(\|a\|, \|b\|)`, clamped [0, 1] |
| `dateProximity(a, b)` | Linear decay: `(90 - diffDays) / 90`, 0 after 90 days |

### Multi-value matching

**File:** `lib/multi-value.ts`

Fields like Customer ID and Order ID can contain multiple values (e.g., `"ID1, ID2, ID3"` or `"ID1 / ID2"`). The engine uses `parseMultiValueInput()` and `parseMultiValueMatchSet()` to parse and compare these, supporting both strict "id" parsing and relaxed "text" parsing.

---

## 10. Allocation & Aggregates

### Line-level allocation

**File:** `lib/matching/deposit-line-allocations.ts`

`recomputeDepositLineItemAllocations(client, depositLineItemId, tenantId)`:

- Sums usage and commission from all **Applied** matches
- Determines line status:
  - `Matched` — fully allocated (remaining ≤ EPSILON of 0.005)
  - `PartiallyMatched` — some matches exist with non-zero amounts
  - `Unmatched` — no effective matches
- Sets `primaryRevenueScheduleId` to the match with highest combined weight (`|usage| + |commission|`)
- Skips lines with `Ignored` status
- Throws error if line is already `reconciled`

### Deposit-level aggregates

**File:** `lib/matching/deposit-aggregates.ts`

`recomputeDepositAggregates(client, depositId, tenantId)`:

- Queries all line items for the deposit
- Computes:
  - `totalUsage`, `usageAllocated`, `usageUnallocated`
  - `totalCommissions`, `commissionAllocated`, `commissionUnallocated`
  - `totalItems`, `itemsReconciled`, `itemsUnreconciled`
  - Counts: matched, partial, ignored
- Sets deposit status:
  - `Pending` — no items or no matched/ignored items
  - `InReview` — any items matched, ignored, or partially matched
  - **Never** auto-sets `Completed` (requires explicit finalization)

---

## 11. Match Groups & Manual Matching

### Match types

| Type | Description | Example |
|------|-------------|---------|
| `OneToOne` | 1 line item → 1 revenue schedule | Simple direct match |
| `OneToMany` | 1 line item → N revenue schedules | One deposit row covers multiple schedules |
| `ManyToOne` | N line items → 1 revenue schedule | Multiple deposit rows combine into one schedule |
| `ManyToMany` | N line items → N revenue schedules | Complex cross-matching |

### Match group preview

**File:** `lib/matching/match-group-preview.ts`

`buildMatchGroupPreview()` validates the selection before applying:

- Validates match type vs. selection counts (e.g., OneToOne requires exactly 1 + 1)
- Validates lines are not reconciled, not ignored, not negative chargebacks
- Computes default allocations based on match type
- Returns before/after summaries for both lines and schedules

### Default allocation strategies

**OneToMany** (1 line → N schedules):
- Splits line amounts proportionally by schedule expected weight (`|expectedUsageNet| + |expectedCommissionNet|`)
- Last schedule gets remainder to avoid rounding

**ManyToOne** (N lines → 1 schedule):
- Each line's full unallocated amount goes to the single schedule

**ManyToMany** (N lines → N schedules):
- FIFO waterfall: schedules sorted by date asc → createdAt asc; lines sorted by lineNumber asc → createdAt asc
- For each line, fills schedules in order until line's unallocated amount is exhausted
- Tracks remaining capacity per schedule across lines

### Auto-match flow

**Endpoint:** `POST /api/reconciliation/deposits/[depositId]/auto-match`

1. Iterates all unmatched line items in the deposit
2. For each, calls `matchDepositLine()`
3. If top candidate confidence ≥ 0.97 → auto-applies the match (creates Applied match record)
4. Returns summary: `{ processed, autoMatched, alreadyMatched, belowThreshold, noCandidates, errors }`

### Manual match flow (apply match group)

**Endpoint:** `POST /api/reconciliation/deposits/[depositId]/matches/apply`

Accepts: `{ matchType, lineIds, scheduleIds, allocations? }`

1. Calls `buildMatchGroupPreview()` to validate
2. Creates `DepositMatchGroup` record
3. For each allocation → upserts `DepositLineMatch` (Applied status)
4. Recomputes line allocations
5. Recomputes deposit aggregates

### Undo match group

**Endpoint:** `POST /api/reconciliation/deposits/[depositId]/matches/[matchGroupId]/undo`

1. Marks match group as `Undone`
2. Removes or rejects associated matches
3. Recomputes line allocations and deposit aggregates

### Single line match

**Endpoint:** `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match`

Handles individual match application, including:
- Negative line (chargeback) handling
- Allocation amount validation
- Flex auto-adjust for overpayments

### Unmatch a line

**Endpoint:** `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch`

1. Deletes all matches for the line item
2. Resets status to `Unmatched`
3. Soft-deletes orphaned flex schedules
4. Recomputes deposit aggregates

---

## 12. Flex System (Overpayments & Chargebacks)

The flex system handles scenarios where deposit amounts don't exactly match revenue schedule expectations.

### Flex decision types

| Action | Description |
|--------|-------------|
| `none` | No flex needed — amounts match within tolerance |
| `auto_adjust` | System auto-adjusts the revenue schedule to match deposit amount |
| `prompt` | User must choose how to handle the variance |
| `auto_chargeback` | System auto-processes as a chargeback (negative line) |

### Flex decision payload

```typescript
{
  action: FlexDecisionAction
  usageOverage: number           // How much the deposit exceeds expected
  usageUnderpayment: number      // How much the deposit falls short
  usageToleranceAmount: number   // Configurable tolerance threshold
  overageAboveTolerance: boolean // Whether overage exceeds tolerance
  allowedPromptOptions: Array<"Adjust" | "Manual" | "FlexProduct">
}
```

### Flex endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `.../line-items/[lineId]/create-flex` | Create a flex schedule for an overpayment |
| POST | `.../line-items/[lineId]/approve-flex` | Approve a pending flex adjustment |
| POST | `.../line-items/[lineId]/resolve-flex` | Resolve a flex item |
| POST | `.../line-items/[lineId]/ai-adjustment/preview` | Preview AI-suggested adjustment |
| POST | `.../line-items/[lineId]/ai-adjustment/apply` | Apply AI-suggested adjustment |

### Flex review queue

A dedicated page at `/reconciliation/flex-review` shows all pending flex items that require user attention.

---

## 13. Finalization & Unfinalization

### Finalize

**Endpoint:** `POST /api/reconciliation/deposits/[depositId]/finalize`

**Prerequisites:**
- Deposit must not already be `Completed`
- No line items in `Unmatched` or `Suggested` status (all must be `Matched`, `PartiallyMatched`, or `Ignored`)

**Disputed schedule policy** (tenant setting `finalizeDisputedDepositsPolicy`):

| Policy | Behavior |
|--------|----------|
| `block_all` | Blocks finalization if any matched schedule has `billingStatus = InDispute` |
| `allow_manager_admin` | Only `reconciliation.manage` permission or ADMIN role can finalize |
| `allow_all` | No restriction |

**Process (within transaction):**

1. Marks all `Matched` / `PartiallyMatched` line items as `reconciled: true`
2. Marks all `Applied` matches as `reconciled: true`
3. Collects all matched revenue schedule IDs
4. Calls `recomputeRevenueSchedules()` to update schedule statuses (e.g., moves from `Unreconciled` to `Reconciled`, `Underpaid`, or `Overpaid`)
5. Updates deposit: `status = Completed`, `reconciled = true`, `reconciledAt = now()`
6. Logs matching metric event `"finalize"`
7. Creates audit log entries for each affected revenue schedule and the deposit

### Unfinalize

**Endpoint:** `POST /api/reconciliation/deposits/[depositId]/unfinalize`

Reverses finalization:

1. Unmarks `reconciled` flags on line items and matches
2. Recomputes revenue schedule statuses
3. Sets deposit status to `InReview`

---

## 14. Deposit Deletion

**Endpoint:** `DELETE /api/reconciliation/deposits/[depositId]`

**Guards:**
- Deposit must not be reconciled (`reconciled = false`)
- Deposit must not be `Completed` status

**Transaction:**
1. Finds all `DepositLineMatch` records linked via deposit's line items
2. Records linked Revenue Schedule IDs
3. Deletes all `DepositLineMatch` records for this deposit
4. Deletes all `DepositLineItem` records for this deposit
5. Recomputes affected revenue schedules (restores balances)
6. Deletes the `Deposit` record
7. Logs audit entries for affected revenue schedules

---

## 15. Bundle Rip-Replace on Deposits

**Endpoints:**
- `POST /api/reconciliation/deposits/[depositId]/bundle-rip-replace/apply` — apply a bundle rip-replace operation
- `POST /api/reconciliation/deposits/[depositId]/bundle-rip-replace/[bundleAuditLogId]/undo` — undo a bundle rip-replace

Bundle operations allow replacing matched revenue schedules with different ones (e.g., when a bundle is restructured), tracked through `BundleOperation` records.

---

## 16. Verification

**Endpoint:** `POST /api/reconciliation/deposits/[depositId]/verification`

Updates payment verification fields on the deposit:
- `actualReceivedAmount` — the verified received amount
- `receivedDate` — date payment was received
- `receivedBy` — person who received the payment

---

## 17. API Reference

### Deposits

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reconciliation/deposits` | List deposits (paginated, filterable) |
| POST | `/api/reconciliation/deposits/import` | Upload and import a deposit file |
| GET | `/api/reconciliation/deposits/import-field-catalog` | Get all mappable fields |
| DELETE | `/api/reconciliation/deposits/[depositId]` | Delete a deposit |
| GET | `/api/reconciliation/deposits/[depositId]/detail` | Get deposit + all line items |
| POST | `/api/reconciliation/deposits/[depositId]/auto-match` | Run auto-matching |
| POST | `/api/reconciliation/deposits/[depositId]/auto-match/preview` | Preview auto-match |
| GET | `/api/reconciliation/deposits/[depositId]/matches` | Get all matches for a deposit |
| POST | `/api/reconciliation/deposits/[depositId]/matches/apply` | Apply a match group |
| POST | `/api/reconciliation/deposits/[depositId]/matches/preview` | Preview a match group |
| POST | `/api/reconciliation/deposits/[depositId]/matches/[matchGroupId]/undo` | Undo a match group |
| GET | `/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates` | Get match candidates |
| POST | `/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match` | Apply single match |
| POST | `/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch` | Unmatch a line |
| POST | `/api/reconciliation/deposits/[depositId]/line-items/[lineId]/create-flex` | Create flex schedule |
| POST | `/api/reconciliation/deposits/[depositId]/line-items/[lineId]/approve-flex` | Approve flex |
| POST | `/api/reconciliation/deposits/[depositId]/line-items/[lineId]/resolve-flex` | Resolve flex |
| POST | `/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/preview` | Preview AI adjustment |
| POST | `/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/apply` | Apply AI adjustment |
| POST | `/api/reconciliation/deposits/[depositId]/finalize` | Finalize deposit |
| POST | `/api/reconciliation/deposits/[depositId]/unfinalize` | Unfinalize deposit |
| POST | `/api/reconciliation/deposits/[depositId]/verification` | Update verification |
| POST | `/api/reconciliation/deposits/[depositId]/bundle-rip-replace/apply` | Apply bundle rip-replace |
| POST | `/api/reconciliation/deposits/[depositId]/bundle-rip-replace/[bundleAuditLogId]/undo` | Undo bundle rip-replace |

### Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reconciliation/templates` | List templates (by distributor + vendor) |
| POST | `/api/reconciliation/templates` | Create a template |
| GET | `/api/reconciliation/templates/[templateId]` | Get template detail |
| PATCH | `/api/reconciliation/templates/[templateId]` | Update template |
| POST | `/api/reconciliation/templates/multi-vendor-preview` | Preview multi-vendor template resolution |
| GET | `/api/reconciliation/templates/mapping-export` | Export template mapping |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET/PATCH | `/api/reconciliation/settings` | Reconciliation settings (variance tolerance, etc.) |
| GET/PATCH | `/api/reconciliation/user-settings` | Per-user reconciliation preferences |

---

## 18. UI Pages & Components

### Pages

| Route | Description |
|-------|-------------|
| `/reconciliation` | Main reconciliation dashboard |
| `/reconciliation/[depositId]` | Deposit detail page |
| `/reconciliation/[depositId]/ai-matching` | AI matching page |
| `/reconciliation/[depositId]/finalize` | Finalize page |
| `/reconciliation/deposit-upload-list` | Upload wizard |
| `/reconciliation/flex-review` | Flex review queue |

### Key components

| Component | File | Description |
|-----------|------|-------------|
| DepositReconciliationDetailView | `components/deposit-reconciliation-detail-view.tsx` | Main detail view with line items table, match status, bulk actions |
| DepositReconciliationTopSection | `components/deposit-reconciliation-top-section.tsx` | Header with deposit metadata and summary stats |
| DepositVendorSummaryWidget | `components/deposit-vendor-summary-widget.tsx` | Vendor summary breakdown |
| DepositVendorSummaryFloatingWidget | `components/deposit-vendor-summary-floating-widget.tsx` | Floating vendor summary |
| DepositLineStatusFilterDropdown | `components/deposit-line-status-filter-dropdown.tsx` | Line status filter |
| ReconciliationScheduleStatusFilterDropdown | `components/reconciliation-schedule-status-filter-dropdown.tsx` | Schedule status filter |
| ReconciliationSettingsForm | `components/reconciliation-settings-form.tsx` | Settings form |
| ReconciliationMatchWizardModal | `components/reconciliation-match-wizard-modal.tsx` | 4-step manual match wizard |
| AutoMatchPreviewModal | `components/auto-match-preview-modal.tsx` | Auto-match preview |

### Upload wizard components

| Component | File | Step |
|-----------|------|------|
| CreateTemplateStep | `components/deposit-upload/create-template-step.tsx` | Step 1: Select distributor/vendor, upload file |
| MapFieldsStep | `components/deposit-upload/map-fields-step.tsx` | Step 2: Map columns to fields |
| ReviewStep | `components/deposit-upload/review-step.tsx` | Step 3: Review mapped data |
| ConfirmStep | `components/deposit-upload/confirm-step.tsx` | Step 4: Confirm and import |

---

## 19. Key Library Files

### Deposit import

| File | Purpose |
|------|---------|
| `lib/deposit-import/parse-file.ts` | CSV/Excel/PDF file parsing |
| `lib/deposit-import/field-catalog.ts` | All mappable import fields |
| `lib/deposit-import/field-suggestions.ts` | Auto-mapping / synonym matching |
| `lib/deposit-import/fields.ts` | Legacy field definitions |
| `lib/deposit-import/template-mapping-v2.ts` | V2 mapping config (current) |
| `lib/deposit-import/template-mapping.ts` | V1 mapping config (legacy) |
| `lib/deposit-import/multi-vendor-template-resolver.ts` | Multi-vendor row grouping and template resolution |
| `lib/deposit-import/multi-vendor.ts` | Summary row detection and skipping |
| `lib/deposit-import/normalize.ts` | Key normalization utilities |
| `lib/deposit-import/resolve-header.ts` | Spreadsheet header name resolution |
| `lib/deposit-import/telarus-template-master.ts` | Telarus template auto-seeding |
| `lib/deposit-import/telarus-template-fields.ts` | Telarus-specific field definitions |

### Matching

| File | Purpose |
|------|---------|
| `lib/matching/deposit-matcher.ts` | Core matching engine (legacy + hierarchical) |
| `lib/matching/deposit-aggregates.ts` | Deposit-level aggregate recomputation |
| `lib/matching/deposit-line-allocations.ts` | Line-level allocation recomputation |
| `lib/matching/match-group-preview.ts` | Match group validation and preview |
| `lib/matching/match-selection.ts` | Match type classification |

### Multi-value parsing

| File | Purpose |
|------|---------|
| `lib/multi-value.ts` | Parse and compare multi-value fields (e.g., "ID1, ID2 / ID3") |

---

## 20. Environment Variables

| Variable | Description |
|----------|-------------|
| `HIERARCHICAL_MATCHING_ENABLED` | Enable hierarchical matching engine (`"true"`) |
| `NEXT_PUBLIC_HIERARCHICAL_MATCHING` | Client-side flag for hierarchical matching |
| `MATCHING_DEBUG_LOG` | Enable matching debug logging |
| `HIERARCHICAL_MATCHING_DEBUG` | Enable hierarchical matching debug output |
| `NEXT_PUBLIC_MATCHING_DEBUG_LOG` | Client-side matching debug flag |
| `DEPOSIT_IMPORT_SKIP_SUMMARY_ROWS` | Skip totals/summary rows during import (`"1"`, `"true"`, `"yes"`, `"on"`) |

---

## 21. Troubleshooting

### Upload errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Missing mapping for required fields: Actual Usage or Actual Commission" | Neither Usage nor Commission is mapped | Map at least one of these fields |
| "Column … is ambiguous" | Two headers normalize to the same value | Rename or remove duplicate headers in the file |
| "Column … not found in uploaded file" | Mapping references a non-existent header | Re-map to the correct header |
| PDF errors (password/no text/no header) | PDF is locked, scanned, or not table-like | Export to CSV or Excel |

### Multi-vendor errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Unable to resolve vendor account(s)…" | File vendor names don't match CRM accounts | Align file vendor labels with CRM account `accountName` or `accountLegalName` |
| "Missing reconciliation template(s) for vendor(s)…" | Templates don't exist for some vendors | Create templates for missing vendors |

### Matching issues

| Issue | Cause | Fix |
|-------|-------|-----|
| No candidates found | Date window too narrow, or schedules already reconciled | Expand date window, verify schedule status |
| Low confidence scores | Account/vendor names differ, or amounts don't match | Verify data quality; consider increasing variance tolerance |
| Auto-match not triggering | Confidence below 0.97 threshold | Review matching signals; improve data consistency |
| Strong ID conflict blocking fuzzy | IDs exist on both sides but differ | Correct the ID data in either the deposit or schedule |

### Finalization issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Deposit has unmatched line items" | Lines in Unmatched or Suggested status | Match or ignore remaining lines |
| Blocked by disputed schedules | `finalizeDisputedDepositsPolicy` set to `block_all` | Resolve disputes, or adjust policy |
