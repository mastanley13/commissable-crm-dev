# Deposit Upload Wizard & Mapping – Testing Guide

**Date:** 2025-12-04  
**Audience:** QA / Ops / Dev reviewers  

---

## 1. Environment Setup
1. `npm install` (pulls `papaparse`, `xlsx`).
2. `npm run dev` (or use staging deployment if available).
3. Seed/test accounts with at least one distributor, vendor, customer, and reconciliation template.

---

## 2. Test Data
Prepare sample CSV/XLSX files containing (at minimum) columns for:
- `Usage Amount` (numeric)
- `Commission Amount` (numeric)
- Optional: `Line Number`, `Account Name`, `Location ID`, `Customer PO`, etc.

Include both valid and intentionally malformed rows for negative testing.

---

## 3. Manual Test Matrix

### A. Happy Path (CSV)
1. Open `/reconciliation/deposit-upload-list`.
2. Fill Created By, Deposit Name, Customer, Date, Distributor, Vendor, Template.
3. Upload CSV file.
4. Map columns to required fields (Usage, Commission).
5. Proceed through Review → Confirm.
6. Verify success banner + link to `/reconciliation/{depositId}`.
7. Inspect deposit in Reconciliation detail view (line items populated).

### B. XLSX Support
Repeat steps above using an `.xlsx` file with multiple sheets (only the first sheet is imported). Confirm parsing and import succeed.

### C. Missing File / Mapping
- Attempt to proceed without selecting a file → Step 1 “Proceed” disabled.
- Upload file but leave Mapping blank → See required field warnings; cannot continue.

### D. Parsing Errors
- Upload unsupported file (e.g., TXT) → Map step shows parsing error.
- Upload CSV without headers → Validation error on both client and API.

### E. Template Reuse
1. Complete mapping for a template.
2. Re-open wizard with same template.
3. Verify mapping auto-populates from saved config.

### F. API Validation
- Use DevTools to remove required mapping from FormData before submit → API returns descriptive error, UI surfaces message.

### G. Data Integrity
- Use Prisma Studio or DB query to confirm:
  - `Deposit` record has correct totals (`totalItems`, `totalUsage`, etc.).
  - `DepositLineItem` rows match file data.
  - `ImportJob` entry exists with accurate counts.

---

## 4. Edge Cases
- Large numeric values (usage, commission).
- Negative usage adjustment (if column mapped).
- Dates in various formats (ISO string, mm/dd/yyyy, Excel serial).
- Duplicate or blank headers.

---

## 5. Regression Checks
- Reconciliation detail page still loads deposits created before this feature (no schema changes).
- Templates API endpoints continue to function (GET/POST).
- Other deposit API endpoints unaffected (auto-match, finalize, etc.).

---

## 6. Reporting
Log defects with:
- File sample and mapping used.
- Step where failure occurred.
- API response (if applicable).
- Browser console/network logs.

---

## References
- [Implementation Summary](12-4-25-Deposit-Upload-Implementation-Summary.md)
- [Review Report](12-4-25-Deposit-Upload-Review-Report.md)
- [Implementation Plan](12-4-25-Deposit-Upload-Implementation-Plan.md)
