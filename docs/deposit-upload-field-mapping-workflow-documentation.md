# Deposit Upload, Field Mapping & Template Workflow Documentation

## Executive Summary

The Deposit Upload system in Commissable CRM provides a powerful, flexible way to import commission deposit data from distributors. The system features:

- **Multi-format file support** (CSV, Excel, PDF)
- **Intelligent field mapping** with auto-suggestions
- **Reusable templates** for consistent imports
- **Multi-vendor uploads** in a single file
- **Comprehensive validation** at every step

This document provides a detailed walkthrough of the entire workflow from file upload to deposit creation.

---

## Table of Contents

1. [Workflow Overview](#workflow-overview)
2. [Step 1: Create Template](#step-1-create-template)
3. [Step 2: Map Fields](#step-2-map-fields)
4. [Step 3: Review & Import](#step-3-review--import)
5. [Supported File Formats](#supported-file-formats)
6. [Field Mapping System](#field-mapping-system)
7. [Template System](#template-system)
8. [Multi-Vendor Upload](#multi-vendor-upload)
9. [Validation & Error Handling](#validation--error-handling)
10. [Key Features Summary](#key-features-summary)

---

## Workflow Overview

The deposit upload process follows a 3-step wizard:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEPOSIT UPLOAD WORKFLOW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   STEP 1: CREATE TEMPLATE                                           │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ • Select/Upload File (CSV, Excel, PDF)                       │  │
│   │ • Select Distributor Account                                 │  │
│   │ • Select Vendor Account (or enable Multi-Vendor)             │  │
│   │ • Set Payment Date & Commission Period                       │  │
│   │ • Select or Create Reconciliation Template                   │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│   STEP 2: MAP FIELDS                                                │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ • View parsed file headers and sample data                   │  │
│   │ • Map columns to system fields (Usage, Commission, etc.)     │  │
│   │ • Create custom fields for additional data                   │  │
│   │ • Exclude/ignore irrelevant columns                          │  │
│   │ • Review auto-suggestions from templates                     │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│   STEP 3: REVIEW & IMPORT                                           │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ • Preview mapped data                                        │  │
│   │ • Validate all required fields                               │  │
│   │ • Review row counts and field coverage                       │  │
│   │ • Optionally save mapping to template                        │  │
│   │ • Submit import                                              │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│   RESULT: Deposit & Line Items Created                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Template

The first step configures the deposit upload and selects or creates a template.

### Required Fields

| Field | Description | Required |
|-------|-------------|----------|
| **File Upload** | CSV, Excel (.xlsx/.xls), or PDF file | Yes |
| **Distributor Account** | The distributor sending the commission data | Yes |
| **Vendor Account** | The vendor whose commissions are in the file | Yes (unless Multi-Vendor) |
| **Payment Date** | Date the deposit was received (defaults to today) | Yes |
| **Commission Period** | Month/period the commissions cover | Auto-fills from payment date |

### Optional Fields

| Field | Description |
|-------|-------------|
| **Reconciliation Template** | Previously saved mapping template to pre-populate field mappings |
| **Deposit Name** | Custom name for the deposit (auto-generated if blank) |
| **Multi-Vendor Mode** | Enable to upload deposits for multiple vendors in one file |
| **Created By Contact** | Sales contact associated with this deposit |

### Template Selection

When you select a Distributor and Vendor:
1. The system queries for existing templates for that combination
2. If templates exist, they appear in a dropdown for selection
3. If no templates exist but a Telarus match is found, a template is auto-created
4. You can also create a new template inline

### File Upload Area

- Drag and drop or click to select a file
- Supported formats: `.csv`, `.xlsx`, `.xls`, `.pdf`
- File is parsed immediately upon selection
- Headers and sample rows are extracted for the mapping step

---

## Step 2: Map Fields

The field mapping step is where you connect columns from your file to system fields.

### Interface Layout

The mapping interface displays a 4-column grid:

| Column | Description |
|--------|-------------|
| **Field Label in File** | The header name from your uploaded file |
| **Preview Information** | Sample values from the first few rows |
| **Status** | Current mapping status (Mapped, Custom, Unmapped, Excluded) |
| **Map to Import Field** | Dropdown to select the target field |

### Tab Organization

Columns are organized into three tabs:

1. **Template Fields** - Columns that match mappings from your selected template
2. **New Fields** - Columns with data but not in the template (may have auto-suggestions)
3. **Excluded** - Empty columns or columns marked to ignore

### Mapping Options

For each column, you can choose to:

| Option | Description |
|--------|-------------|
| **Map to System Field** | Connect to a standard field (Usage, Commission, etc.) |
| **Create Custom Field** | Define a new field for additional data |
| **Additional Info** | Store data without specific field mapping |
| **Ignore** | Skip this column during import |

### Required Fields

At minimum, you must map **Usage** OR **Commission** (or both):

- **Usage (Actual Usage)**: The billable amount or MRC
- **Commission**: The commission amount earned

### Smart Auto-Mapping

The system automatically suggests mappings based on:

1. **Template Mappings**: If you selected a template, saved mappings are applied
2. **Header Synonyms**: Common column name variations are recognized:

| System Field | Recognized Headers |
|--------------|-------------------|
| Usage | "usage", "usage amount", "actual usage", "mrc", "total bill", "rev" |
| Commission | "commission", "total commission", "actual commission", "comm" |
| Account Name | "customer name", "account legal name", "company name", "customer" |
| Commission Rate | "commission rate", "commission percent", "%", "rate" |
| Product Name | "product name", "service name", "product", "sku name" |
| Vendor Name | "vendor", "vendor name", "supplier" |

### Undo Support

The mapping interface supports up to 50 undo steps, allowing you to experiment with different mapping configurations and revert changes.

---

## Step 3: Review & Import

The final step validates your configuration and imports the deposit.

### Summary Display

- **Rows Detected**: Total data rows in your file
- **Mapped Fields**: Count of columns mapped to system fields
- **Validation Status**: Pass/fail indicators for required fields

### Review Tabs

| Tab | Contents |
|-----|----------|
| **Mapped** | All columns with mappings - review what will be imported |
| **Unmapped/Excluded** | Columns being skipped - verify nothing important is missed |

### Validation Checks

The system validates:

1. **Required Fields**: Usage or Commission must be mapped
2. **Multi-Vendor**: If enabled, Vendor Name must be mapped
3. **Data Rows**: File must contain at least one data row
4. **Column Matches**: Mapped columns must exist in the file

### Save Template Option

Check **"Save mapping updates to this template"** to:
- Store your field mappings for future uploads
- Next time you upload from the same Distributor/Vendor, mappings pre-populate
- Only affects future uploads - existing deposits are unchanged

### Import Button

Click **"Start Import"** to:
1. Create the Deposit record
2. Create DepositLineItem records for each row
3. Optionally update the template with new mappings
4. Return the deposit ID for navigation

---

## Supported File Formats

### CSV Files

- Standard comma-separated values
- UTF-8 encoding recommended
- First row treated as headers
- Empty rows are skipped

### Excel Files (.xlsx, .xls)

- First sheet is processed
- First row treated as headers
- Excel date serial numbers are converted automatically
- Formulas are evaluated to their values

### PDF Files

- Text-based PDFs only (not scanned images)
- Table structure is detected using text positioning
- Lines are grouped by Y-coordinate
- Columns detected using X-axis gaps
- Password-protected PDFs show a helpful error message

### Parsing Details

| Format | Library Used | Special Handling |
|--------|--------------|------------------|
| CSV | PapaParse | Handles various delimiters |
| Excel | XLSX.js | Excel date conversion |
| PDF | Custom parser | Table structure detection |

---

## Field Mapping System

### Available Target Fields

The system supports 60+ mapping targets across 5 entity types:

#### Deposit Line Item Fields (Core)

| Field | Description | Data Type |
|-------|-------------|-----------|
| **Usage** | Actual usage/billable amount | Number |
| **Commission** | Commission amount earned | Number |
| **Commission Rate** | Commission percentage | Number (decimal) |
| **Line Number** | Row number in source file | Number |
| **Payment Date** | Date for this specific line | Date |
| **Account Name (Raw)** | Customer/account name as provided | Text |
| **Account ID (Vendor)** | Vendor's account identifier | Text |
| **Customer ID (Vendor)** | Vendor's customer identifier | Text |
| **Order ID (Vendor)** | Vendor's order identifier | Text |
| **Product Name (Raw)** | Product/service name as provided | Text |
| **Part Number (Raw)** | Part/SKU number as provided | Text |
| **Vendor Name (Raw)** | Vendor name (for multi-vendor) | Text |
| **Distributor Name (Raw)** | Distributor name as provided | Text |
| **Location ID** | Location/site identifier | Text |
| **Customer PO** | Customer purchase order number | Text |

#### Deposit Fields

| Field | Description |
|-------|-------------|
| **Deposit Name** | Name for the deposit record |
| **Payment Date** | Deposit-level payment date |

#### Opportunity Fields

| Field | Description |
|-------|-------------|
| **Opportunity Name** | Name of related opportunity |
| **Stage** | Sales stage |
| **Status** | Opportunity status |
| **Type** | Opportunity type |
| **Amount** | Deal amount |
| **Expected Commission** | Expected commission value |
| **Close Dates** | Estimated and actual close dates |

#### Product Fields

| Field | Description |
|-------|-------------|
| **Product Code** | Internal product code |
| **Product Name (House)** | Internal product name |
| **Product Name (Vendor)** | Vendor's product name |
| **Description** | Product description |
| **Revenue Type** | Type of revenue |
| **Price Each** | Unit price |
| **Commission Percent** | Product commission rate |

#### Matching Fields

| Field | Description |
|-------|-------------|
| **External Schedule ID** | ID for matching to revenue schedules |

### Custom Fields

You can create custom fields for data not covered by standard fields:

1. Click **"Create custom field"** in the mapping dropdown
2. Enter a label for the field
3. Choose a section: **Additional Info** or **Product Info**
4. The field is saved and can be reused in templates

Custom fields are stored in the `metadata` JSON column of DepositLineItem records.

### Data Type Handling

| Data Type | Normalization |
|-----------|---------------|
| **Numbers** | Strips non-numeric characters, validates decimals |
| **Strings** | Trims whitespace, null if empty |
| **Dates** | Handles ISO format and Excel serial numbers |
| **Booleans** | Recognizes true/yes/1 and false/no/0 |

---

## Template System

Templates store field mapping configurations for reuse.

### How Templates Work

```
┌─────────────────────────────────────────────────────────────────┐
│                      TEMPLATE LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CREATION                                                     │
│     • Created when first importing for a Distributor/Vendor      │
│     • Auto-seeded from Telarus master data if available          │
│     • Or manually created by user                                │
│                                                                  │
│  2. STORAGE                                                      │
│     • Stored per Tenant/Distributor/Vendor combination           │
│     • Contains full mapping configuration (V2 format)            │
│     • Includes custom field definitions                          │
│                                                                  │
│  3. REUSE                                                        │
│     • Automatically suggested when same Distributor/Vendor       │
│     • Pre-populates field mappings                               │
│     • User can modify and save updates                           │
│                                                                  │
│  4. UPDATE                                                       │
│     • Save changes during import with checkbox                   │
│     • Only affects future uploads                                │
│     • Existing deposits unchanged                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Template Configuration Structure

Templates store a JSON configuration with:

```
{
  "depositMapping": {
    "version": 2,
    "targets": {
      "depositLineItem.usage": "Actual Usage",
      "depositLineItem.commission": "Commission Amount",
      "depositLineItem.accountNameRaw": "Customer Name"
    },
    "columns": {
      "Actual Usage": { "mode": "target", "targetId": "depositLineItem.usage" },
      "Customer Name": { "mode": "target", "targetId": "depositLineItem.accountNameRaw" },
      "Notes": { "mode": "custom", "customKey": "cf_notes" },
      "Total Row": { "mode": "ignore" }
    },
    "customFields": {
      "cf_notes": { "label": "Notes", "section": "additional" }
    }
  }
}
```

### Telarus Auto-Seeding

For known distributor/vendor combinations, templates are auto-created from Telarus master data:

1. System detects Distributor + Vendor selection
2. Checks Telarus vendor map master CSV for matches
3. If match found, creates template with pre-configured mappings
4. Template is immediately usable with no manual setup

### Template Uniqueness

Templates are unique per:
- **Tenant ID** (multi-tenancy)
- **Distributor Account ID**
- **Vendor Account ID**
- **Template Name**

You can have multiple templates for the same Distributor/Vendor with different names.

---

## Multi-Vendor Upload

Upload deposits for multiple vendors in a single file.

### Enabling Multi-Vendor Mode

1. Toggle **"Multi-Vendor"** in Step 1
2. The single Vendor Account dropdown is disabled
3. You must map the **"Vendor Name"** column in Step 2

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-VENDOR PROCESSING                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT FILE:                                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Vendor Name    | Customer    | Usage  | Commission         │ │
│  │ Vendor A       | Customer 1  | 1000   | 100                │ │
│  │ Vendor A       | Customer 2  | 2000   | 200                │ │
│  │ Vendor B       | Customer 3  | 1500   | 150                │ │
│  │ Vendor B       | Customer 4  | 3000   | 300                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  PROCESSING:                                                     │
│  • Rows grouped by "Vendor Name" column                          │
│  • Each vendor creates a separate Deposit                        │
│  • Rows without vendor names are skipped                         │
│  • All vendors must exist in CRM                                 │
│                              ↓                                   │
│  OUTPUT:                                                         │
│  • Deposit 1: Vendor A (2 line items)                           │
│  • Deposit 2: Vendor B (2 line items)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Validation for Multi-Vendor

- All vendor names in file must match CRM vendor accounts
- Templates must exist for all vendors (or be auto-seeded)
- Rows with empty vendor names are skipped with a warning

---

## Validation & Error Handling

### Client-Side Validation

| Check | When | Message |
|-------|------|---------|
| File required | Step 1 | "Please upload a file" |
| Distributor required | Step 1 | "Please select a distributor" |
| Vendor required | Step 1 (single vendor) | "Please select a vendor" |
| Usage/Commission required | Step 2/3 | "Map Usage or Commission" |
| Vendor Name required | Step 2/3 (multi-vendor) | "Map Vendor Name column" |

### Server-Side Validation

| Check | Error Code | Message |
|-------|------------|---------|
| Invalid file type | 400 | "Unsupported file format" |
| No data rows | 400 | "File contains no data rows" |
| Missing required mapping | 400 | "Usage or Commission must be mapped" |
| Unknown vendor (multi) | 400 | "Vendor not found: [name]" |
| Column not in file | 400 | "Column not found: [name]" |
| Duplicate upload | 409 | "Import already in progress" |

### Idempotency

The system prevents duplicate uploads using idempotency keys:
- Generated when file is selected
- Checked before processing
- Returns cached result if already completed
- Returns 409 error if job in progress

### Audit Logging

All operations are logged for compliance:
- Deposit creation with metadata
- Template creation/updates
- Import job records with timing
- User, IP address, and user agent captured

---

## Key Features Summary

| Feature | Description |
|---------|-------------|
| **Multi-Format Support** | CSV, Excel (.xlsx/.xls), and PDF files |
| **Smart Auto-Mapping** | Header synonym recognition + template hints |
| **60+ Target Fields** | Comprehensive field coverage across 5 entities |
| **Custom Fields** | User-defined fields for additional data |
| **Template Reuse** | Save and reapply mappings for future uploads |
| **Telarus Auto-Seed** | Pre-configured templates for known vendors |
| **Multi-Vendor Mode** | Single file for multiple vendor deposits |
| **Real-Time Validation** | Immediate feedback on mapping issues |
| **Undo Support** | 50-step undo history in field mapping |
| **Idempotency** | Prevents duplicate deposit creation |
| **Audit Trail** | Complete logging of all operations |
| **Atomic Transactions** | All-or-nothing database operations |

---

## Quick Reference

### Minimum Required Steps

1. Upload a file
2. Select Distributor and Vendor
3. Map at least Usage OR Commission
4. Click "Start Import"

### Best Practices

1. **Use Templates**: Select existing templates to speed up mapping
2. **Save Template Updates**: Check the save option to preserve your mappings
3. **Review Sample Data**: Check the preview columns to verify parsing
4. **Map All Relevant Fields**: More mapped fields = better data for reconciliation
5. **Name Your Deposits**: Use descriptive names for easy identification

### Troubleshooting

| Issue | Solution |
|-------|----------|
| File not parsing | Ensure file is CSV, Excel, or text-based PDF |
| Template not appearing | Check Distributor/Vendor selection matches |
| Import failing | Verify all mapped columns exist in file |
| Wrong data in fields | Check column mapping and data types |
| PDF not parsing | Ensure PDF contains selectable text (not scanned) |

---

*Documentation generated for Commissable CRM - Deposit Upload System*
