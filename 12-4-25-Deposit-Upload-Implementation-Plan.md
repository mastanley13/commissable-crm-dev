# Deposit Upload Wizard – Implementation Plan (Original Design)

**Date:** 2025-12-03 (baseline)  
**Owner:** Codex  

---

## Goals
1. Provide a guided wizard for uploading real distributor/vendor deposit files.
2. Allow configurable mapping between vendor-specific columns and Commissable fields.
3. Persist mappings per template to accelerate repeat uploads.
4. Import data into Deposits, DepositLineItems, and ImportJob records for observability.

---

## Phases

### Phase A – Wizard Scaffolding
1. Extract wizard steps into dedicated components (`CreateTemplate`, `MapFields`, `Review`, `Confirm`).
2. Manage step state in `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`.
3. Add validation gating so each step controls navigation (`canProceed`, error messaging).

### Phase B – File Parsing & Mapping
1. Add CSV/XLS/XLSX parsing (client-side) using `papaparse` and `xlsx`.
2. Define a shared set of deposit field definitions (`id`, `label`, `type`, `required`, `scope`).
3. Build the mapping UI that lists detected columns and allows mapping to Commissable fields.
4. Pre-populate mapping from template config when available.
5. Show sample rows and validation output in the Review step.

### Phase C – Import API
1. Create `POST /api/reconciliation/deposits/import` endpoint.
2. Parse uploaded file server-side, validate mapping, and construct column index.
3. Create Deposit + DepositLineItem rows within a transaction.
4. Log an `ImportJob` entry (entity=`Reconciliations`, source=`UI`) for observability.
5. Persist updated mapping config back into the chosen template.

### Phase D – UX Polish & Success Flow
1. Show success link to the new deposit or Reconciliation list.
2. Surface API errors within Confirm step.
3. Prefetch deposit detail route post-import for faster navigation.

---

## Requirements Traceability
| Requirement | Phase | Notes |
|-------------|-------|-------|
| Guided wizard w/ validation | A | Stepper + gating implemented |
| Real file parsing | B | CSV & XLSX support added |
| Mapping per template | B/C | Saved in `ReconciliationTemplate.config.depositMapping` |
| Deposit + line creation | C | Transactional insert |
| Import observability | C | ImportJob entries logged |

---

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Large uploads blocking UI | Start with synchronous flow; plan background job handoff later |
| Mapping drift between UI/API | Centralized field definitions used by both | 
| Invalid files | Client + server parsing errors reported with descriptive messaging |

---

## Success Criteria
- Users can complete the wizard using real distributor files without developer assistance.
- At least one pilot template can upload end-to-end and see the resulting deposit in `/reconciliation`.
- ImportJob records provide visibility into success/failure counts.

---

## References
- [Real Deposit Upload Workflow](12-4-25-Real-Deposit-Upload-Workflow.md)
- [Implementation Summary](12-4-25-Deposit-Upload-Implementation-Summary.md)
- [Testing Guide](12-4-25-Deposit-Upload-Testing-Guide.md)
