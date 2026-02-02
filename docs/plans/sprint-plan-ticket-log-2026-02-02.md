# Commissable CRM - Sprint Plan (from Ticket Log)
Source: `docs/commissable_ticket_log_2026-01-21_22_26.md` + `docs/commissable_cursor_context_2026-01-21_22_26.md`  
Plan created: **2026-02-02**

## Goal
Ship an end-to-end reconciliation workflow that can be run with Debra on real files (CRM-QA-002), with clear decisions on any blocked specs and a short list of must-pass acceptance tests (context pack Section 7).

## Current state (from ticket log statuses)
- **Blocked (needs input):** CRM-REC-004, CRM-FLOW-001
- **In progress:** CRM-DEP-001, CRM-REC-008, CRM-FLEX-001, CRM-FLEX-003, CRM-FLEX-004
- **Not started (includes P0 blockers):** CRM-DEP-006, CRM-MATCH-002, CRM-MATCH-004 (+ several P1/P2)
- **Needs confirmation:** CRM-QA-001, CRM-QA-002
- **Needs verification:** CRM-DEP-005, CRM-REC-003, CRM-RS-001

## Progress updates (as of 2026-02-02)
- **CRM-DEP-005 (Upload)**: PDF deposit upload implemented for text-based PDFs (no OCR); needs real-file verification.

## Sprint sizing assumptions
- Sprint 1 focuses on unblocking + closing P0/P0-adjacent work so a Debra E2E run can happen.
- Sprint 2 focuses on multi-vendor upload + deposit detail UX/ops items and remaining P1/P2 work.

---

# Sprint 1 - "Unblock + Stabilize Core Reconciliation" (target: 1 week)

## Sprint 1 outcomes
- Blocked specs resolved (decisions written down and agreed).
- In-progress P0 items completed and verified against their acceptance criteria.
- Non-1:1 matching path has an MVP plan and/or implementation started (depends on bundle/split rules readiness).
- Ready to schedule/run CRM-QA-002 with a defined "real files" dataset.

## Stage 1.0 - Resolve blockers (must do first)
- [ ] **CRM-FLOW-001**: Bundle/split rules spec locked (include at least 5 concrete examples across 1:M, M:1, M:M + undo/unmatch rules).
- [ ] **CRM-REC-004**: "Frozen columns + synced horizontal scroll" spec locked:
  - [ ] Exact list of columns to freeze ("key columns")
  - [ ] Whether lock applies to both top and bottom grids
  - [ ] How horizontal scrollbar behaves (single/shared vs per-grid)
- [ ] **CRM-DEP-005**: PDF support for deposit workflow (upload implemented; export TBD)
  - [x] Upload (machine-readable/text-based only; no OCR) — implemented (2026-02-02)
  - [ ] Export (which views/sections must be in the PDF)
  - [ ] Both (define phased delivery if needed)
  - [ ] **Proposed plan (Upload)** — add PDF as a first-class import type for Deposit Upload:
    - [x] Define Phase 1 scope: machine-readable PDFs only (no OCR), with a clear “not readable” error path
    - [ ] Collect sample PDFs (2–3 per vendor/distributor) + document “expected table” output (headers + rows)
    - [x] UX: allow `.pdf` in file picker + update helper copy/warnings (e.g., “PDF must be text-based”)
    - [x] Backend: parse PDF → `{ headers, rows }` so existing mapping/template flow can be reused
      - [ ] Validate multi-page tables + repeated headers/footer totals with real vendor PDFs
      - [ ] Normalize extracted values to match current import expectations (dates/currency/IDs)
    - [x] Error handling: detect common failure modes (scanned PDF, password-protected, empty extract) and return actionable guidance
    - [ ] Guardrails: file size/page limits, parse timeout, audit/log parse duration + file metadata
    - [x] Tests: added unit coverage for readable + unreadable PDF paths
    - [ ] Acceptance: upload PDF → map fields → create deposit + lines (pending real-file verification)
  - [ ] **Optional Phase 2 (later)** — OCR support (only if needed): decide provider/costs, add OCR pipeline, and extend acceptance tests
- [ ] **CRM-QA-001 / CRM-QA-002**: Confirm checklist delivery + schedule Debra E2E slot; agree on the file set (single-vendor and whether multi-vendor is required for this first run).

## Stage 1.1 - Finish in-progress core tickets (P0/P1 impacting daily use)
- [ ] **CRM-DEP-001 (In progress)**: Deposit mapping UI improvements completed:
  - [ ] Suggested Match visible and non-blocking
  - [ ] Duplicate target mapping prevented with clear inline error
  - [ ] Table height/layout meets laptop-width acceptance criteria
- [ ] **CRM-REC-008 (In progress)**: Account Legal Name + Account Name surfaced:
  - [ ] Mapping dropdown includes Account Legal Name (verify end-to-end import/mapping)
  - [ ] Bottom grid includes Account Name (verify it renders and filters/search behaves as intended)
- [ ] **CRM-FLEX-001 (In progress)**: Chargeback manager approval workflow:
  - [ ] Approve path works end-to-end
  - [ ] Reject path behavior confirmed (what changes, what stays "In Dispute")
  - [ ] "In Dispute" labeling semantics match expectations
- [ ] **CRM-FLEX-003 (In progress)**: Billing Status consistency:
  - [ ] Billing Status values and semantics match what the app needs for filtering/reporting
  - [ ] No regressions in reconciliation flows that depend on status
- [ ] **CRM-FLEX-004 (In progress)**: Flex resolution flow:
  - [ ] One-time vs recurring choice works
  - [ ] Recurring path creates additional schedules as designed
  - [ ] Family/subtype required when renaming/changing product classification

## Stage 1.2 - Start/land P0 matching blockers (depending on Stage 1.0 readiness)
- [ ] **CRM-MATCH-002 (Not started)**: Match-type detection + wizard MVP
  - [ ] Define MVP scope for Sprint 1 (recommend: 1:M + M:1 first; M:M next)
  - [ ] Implement wizard UI skeleton + validation steps aligned to CRM-FLOW-001 rules
  - [ ] Ensure "undo/unmatch" behavior is defined and testable
- [ ] **CRM-MATCH-004 (Not started)**: Diagnose/fix unmatched schedules not showing
  - [ ] Create a repeatable way to reproduce (script, admin view, or query notes)
  - [ ] Fix root cause and confirm known test data shows correctly

## Stage 1.3 - Verification-only items (quick checks)
- [ ] **CRM-DEP-005 (Needs verification)**: Verify PDF deposit upload end-to-end with 1–2 real vendor PDFs (text-based).
- [ ] **CRM-REC-003 (Needs verification)**: Confirm scrollbar behavior is fixed across browsers/layouts used by Debra.
- [ ] **CRM-RS-001 (Needs verification)**: Confirm "Go to revenue schedule" link routes reliably from all entry points.

## Sprint 1 exit criteria (must pass)
- [ ] Context pack acceptance tests:
  - [ ] A) Single-vendor deposit upload (end-to-end)
  - [ ] C) Reconciliation multi-select + match flow (wizard behavior if implemented; otherwise confirm current limitations are acceptable for Debra run)
  - [ ] D) Chargeback manager approval (approve + reject semantics confirmed)
  - [ ] E) Flex resolution (one-time + recurring)
- [ ] **CRM-QA-002**: Debra E2E run can be executed with a pre-agreed dataset; defects are captured as follow-on tickets.

---

# Sprint 2 - "Multi-vendor + UX/ops follow-through" (target: 1 week)

## Sprint 2 outcomes
- Multi-vendor deposit upload works with real reports (no manual file splitting).
- Deposit detail has vendor summary widget for operational reconciliation.
- Remaining matching/admin robustness items shipped (IDs parsing, confidence tuning, etc.).

## Stage 2.1 - Multi-vendor deposit upload (P0)
- [ ] **CRM-DEP-006 (Not started)**: Multi-vendor toggle + ingestion
  - [ ] Upload UI includes Multi-vendor option
  - [ ] Parser skips "Total"/non-transaction rows
  - [ ] Row-level vendor drives template selection
  - [ ] Deposits/lines created without manual splitting
  - [ ] **Proposed implementation plan**
    - [ ] Scope decisions (write down + confirm):
      - [ ] Output model: create **one deposit per vendor** (recommended) vs one deposit containing multiple vendors
      - [ ] Required columns: ensure the upload includes **Vendor Name** and (if needed) **Distributor Name**
      - [ ] Template requirement: Phase 1 requires a saved template per (Distributor, Vendor) combo; missing templates block with a clear action
      - [ ] File types: Phase 1 supports CSV/XLSX/XLS; add PDF multi-vendor only after we have real PDF samples and a stable vendor-column extraction
    - [ ] UX / wizard changes:
      - [ ] Add `Multi-vendor` toggle on Step 1
      - [ ] On file select, pre-parse and show a “Vendors detected” list + counts/total rows
      - [ ] For each detected vendor: pick or auto-resolve the reconciliation template; show missing template warnings + link to create
      - [ ] Mapping step: confirm whether mapping is global or per-vendor (recommended: per-vendor mapping driven by each template)
    - [ ] Ingestion pipeline (server-side):
      - [ ] Add a new multi-vendor import path (new endpoint or a flag) that:
        - [ ] Parses the file once → rows
        - [ ] Filters out non-transaction rows (Totals/subtotals/blank) using explicit rules + vendor-provided samples
        - [ ] Splits rows by `(distributorNameRaw, vendorNameRaw)` and resolves those names → account IDs (with normalization + aliasing if needed)
        - [ ] Resolves the template per group, applies mapping, and creates deposits/lines in a single import job (or one job per deposit)
      - [ ] Guardrails: maximum distinct vendors per file, row limits, and clear partial-failure reporting (which vendors imported vs failed)
      - [ ] Idempotency: define whether the idempotency key applies to the entire file or per vendor-group deposit
    - [ ] Observability / ops:
      - [ ] Persist import summary: vendors detected, vendors imported, skipped rows count, totals per vendor
      - [ ] Actionable errors for: unknown vendor/distributor, missing template, ambiguous vendor names, no transaction rows after filtering
    - [ ] Tests + verification:
      - [ ] Add fixtures for a representative multi-vendor CSV/XLSX (with Totals rows) and assert splits + template resolution
      - [ ] Add an end-to-end verification checklist for Debra’s real multi-vendor report(s)

## Stage 2.2 - Deposit detail ops improvements (P1)
- [ ] **CRM-DEP-008 (Not started)**: Vendor summary widget (allocated/unallocated by vendor)
  - [ ] Counts + totals per vendor (usage + commission; allocated/unallocated)
  - [ ] Updates when filters change (if in scope)

## Stage 2.3 - Matching robustness + admin tooling (P1)
- [ ] **CRM-MATCH-003 (Not started)**: Comma-separated IDs parsing + admin edits + reversible metadata updates
- [ ] **CRM-MATCH-005 (Not started)**: Test dataset (e.g., VoIP) + confidence behavior tuning

## Stage 2.4 - Collections workflow (P1)
- [ ] **CRM-FLEX-002 (Not started)**: Collections flow triggered from Underpaid (confirm artifact: ticket/task/status-only; then implement)

## Stage 2.5 - Revenue schedules / opportunities (P1/P2)
- [ ] **CRM-RS-002 (Not started)**: Extend Contract action
- [ ] **CRM-RS-003 (Not started)**: Change Start Date tool + mandatory reason + export fixes
- [ ] **CRM-OPP-001 (Not started)**: Opportunity Products "Number of Periods" column

## Stage 2.6 - Migration (P1)
- [ ] **CRM-MIG-001 (Not started)**: "Historical Transaction" placeholder product strategy documented + prototype import

## Sprint 2 exit criteria (must pass)
- [ ] Context pack acceptance test B) Multi-vendor deposit upload (end-to-end)
- [ ] Re-run CRM-QA-002 (or run a second Debra session) using at least one multi-vendor report if required by the client workflows.
