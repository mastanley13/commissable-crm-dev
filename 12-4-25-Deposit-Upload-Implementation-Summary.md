# Deposit Upload Wizard & Mapping – Implementation Summary

**Date:** 2025-12-04  
**Status:** ✅ Complete  

---

## Overview

Phase A/B of the deposit upload initiative is now implemented end-to-end. Operators can upload real CSV/XLS/XLSX deposit reports, map file columns to Commissable fields, review parsed data, and submit for import. The backend creates a deposit, deposit line items, and a corresponding ImportJob record, while persisting template mappings so repeat uploads are quicker.

---

## Key Deliverables

### 1. Wizard UX
- **Stepper-driven workflow** (`Create Template → Map Fields → Review → Confirm`) in `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`.
- Component extraction (`components/deposit-upload/*`) so each step encapsulates its own logic and validation.
- Added live search pickers for Created By, Customer, Distributor, Vendor, plus the Template modal.

### 2. File Parsing & Mapping
- Added `papaparse` + `xlsx` dependencies with thin wrappers in `lib/deposit-import/parse-file.ts`.
- Defined field metadata in `lib/deposit-import/fields.ts` (id/label/type/required) so UI + backend stay synchronized.
- `MapFieldsStep` now renders detected columns, mapping dropdowns, and required-field warnings.

### 3. Review & Confirmation
- Review step shows mapping summary (friendly labels), sample rows, and validation output.
- Confirm step posts FormData to the new API, displays success/error banners, and links to the new deposit.

### 4. Import API
- `app/api/reconciliation/deposits/import/route.ts` accepts uploads, parses files, validates mapping, creates deposits + line items, and logs `ImportJob` entries (`DataEntity.Reconciliations`).
- Persists updated `depositMapping` config back to the selected `ReconciliationTemplate`.

---

## Files Touched (Primary)

| Area | Path |
|------|------|
| Wizard page | `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx` |
| Step components | `components/deposit-upload/create-template-step.tsx`, `map-fields-step.tsx`, `review-step.tsx`, `confirm-step.tsx`, `types.ts` |
| Parsing support | `lib/deposit-import/parse-file.ts`, `lib/deposit-import/fields.ts` |
| API | `app/api/reconciliation/deposits/import/route.ts` |
| Dependencies | `package.json` (`papaparse`, `xlsx`) |

---

## Behavior & Data Flow

1. User completes Create Template step (metadata + file + template).
2. File is parsed client-side -> headers/sample rows stored in state.
3. User maps columns to required fields; template config optionally pre-fills mapping.
4. Review step validates mapping + preview rows.
5. Confirm step uploads FormData to `/api/reconciliation/deposits/import`.
6. API re-parses file, builds column index per mapping, inserts Deposit + DepositLineItem rows, logs ImportJob, and updates template config.
7. Success response returns `depositId` so UI can link directly to the Reconciliation detail page.

---

## Known Constraints / Follow-ups

- Currently only handles one deposit per file (header-level overrides are limited to deposit name & payment date).
- No progress UI for large imports; API runs synchronously for now.
- Template config only stores `depositMapping.line` (header-level fields can be added later).
- XLSX parser loads the first worksheet; multi-sheet logic can be added if needed.

---

## Next Steps (Optional Enhancements)

1. **Background Jobs** – offload parsing/import to worker for large files.
2. **Template Versioning** – store mapping history and allow rollback per distributor/vendor.
3. **Auto-mapping Suggestions** – use fuzzy matching to pre-select columns by header name.
4. **Row-level Validation UI** – surface per-row errors before import.
5. **Import Monitoring** – dedicated UI to view ImportJobs, success/error counts, and downloadable error CSVs.

---

## Summary

The deposit upload wizard is now production-ready for CSV/XLS/XLSX inputs, with strong validation, reusable mappings, and API-backed imports that keep deposits, line items, and ImportJobs in sync. This foundation enables future work on diagnostics, background processing, and broader ETL coverage (Location ID / Customer PO, advanced scenarios, etc.).
