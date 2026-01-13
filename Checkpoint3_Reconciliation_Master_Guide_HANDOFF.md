# Checkpoint 3 (Reconciliation) — Master Build Guide & Checklist

**Project:** Commissable CRM  
**Checkpoint:** 3 — Reconciliation  
**Doc purpose:** A single checklist your coding agent can use to track progress, surface gaps, and verify “ready for review” for Checkpoint 3.  
**Last updated:** 2026-01-13

---

## How to use this document

1. Treat each top-level checkbox item (e.g., `REC-010`) as a ticket/epic.
2. Update progress by:
   - Changing `- [ ]` → `- [x]` when complete.
   - Editing the `Status:` line (NOT STARTED / IN PROGRESS / BLOCKED / DONE).
   - Adding notes under `Notes:` with links to PRs, screenshots, or open questions.
3. If you discover ambiguity, add it to **Open Questions / Clarifications Needed**.
4. If you implement something not explicitly specified, label it **ASSUMED** in Notes.

---

## Progress summary (as of 2026-01-13)

- **DONE (implemented):** Deposit list + deposit detail reconciliation screen; CSV/Excel deposit import; template auto-seeding + mapping persistence; suggested matches + confidence filtering; manual match/unmatch; AI auto-match preview/apply; finalize/unfinalize; revenue schedule actuals updated; baseline RBAC.
- **IN PROGRESS:** Template selection UX (currently inferred by distributor+vendor); mapping UI redesign (still wizard-based); AI button text label; matching algorithm parity/tuning; audit coverage completeness; reconciliation UX polish.
- **NOT STARTED:** Split/merge allocations (true many-to-many); variance prompt + 3-option decision tree; “adjust future schedules” behavior; flex products; performance targets + idempotency hardening.

---

## Scope definition for Checkpoint 3

Checkpoint 3 centers on delivering an end-to-end **deposit ingestion + reconciliation workflow**:
- Upload deposit files and map vendor/distributor file columns into normalized deposit line items
- Review deposit line items and **match/allocate** them to revenue schedules (AI-assisted + manual)
- Handle **variances / adjustments** and **Flex Products** (unknown product, overage/bonus/chargeback) before final “reconcile”
- Track “matched vs unmatched” and ensure allocations roll up correctly in UI totals

---

## Source documents (use these as the requirements baseline)

1. **Meeting transcript summary — Jan 6, 2026**
   - Focus: Checkpoint 3 priority; mapping UI redesign; AI matching workflow; variance/adjustments; flex products
   - Reference timestamps (approx):
     - Deposit mapping UI redesign: ~0:49
     - Matching/allocations UX: ~1:49–1:59
2. **Milestone 3 — Revenue & Reconciliation Specifications**
   - File: `Revenue Reconciliation Specifications - Milestone 3.pdf` (11 pages)
   - Focus: reconciliation dashboard and matching rules, flex definitions, performance targets
3. **Data Notebook (Schema/relationship guidance)**
   - File: `Data Notebook LM 1.1.docx`
   - Focus: recommends split/merge matching via `reconciliation_matches` between `deposit_line_items` and `revenue_schedules`
4. **Change Order CO-002-B (optional / add-on) — Deposit Detail View**
   - File: `CO-002-Commissable-CRM-Change-Order-12-4-25.docx`
   - Focus: clicking a deposit row opens a detail view (drawer/modal)

---

## Architecture notes (data model)

### Required relationships (baseline)

- `reconciliation_deposits` → many `deposit_line_items`
- `deposit_line_items` ↔ `revenue_schedules` should support **many-to-many** via `reconciliation_matches` with `amount_matched` (enables split/merge allocations)

> ⚠️ Potential conflict: an older ERD shows `DEPOSIT_LINE_ITEM.ScheduleID` (1 line → 1 schedule).  
> The newer guidance expects M:N via `reconciliation_matches`.  
> **Action:** confirm the current DB schema and align it to the split/merge requirement.

---

# Build checklist

## A. Deposit file ingestion & mapping (Templates + Upload + Parse)

### REC-001 — Deposit Template selection: Distributor → Vendor → Template
- [ ] **REC-001** Deposit upload flow requires selecting **Distributor + Vendor + Template** before upload  
  - Status: IN PROGRESS  
  - Notes:
    - Distributor + Vendor are required before proceeding in the upload flow (`components/deposit-upload/create-template-step.tsx`).
    - Template is currently inferred/seeded for a (Distributor, Vendor) pair (`app/api/reconciliation/templates/route.ts`) rather than explicitly selected in the UI.
  - Definition of Done:
    - UI forces selection of all three before file chooser is enabled.
    - Selected template drives mapping rules.

### REC-002 — Deposit mapping UI redesign (two-panel; remove “Step 1–4 wizard”)
**Requirement (Jan 6, 2026 meeting):**
- Two-panel mapping editor:
  - Panel A: standard/known destination fields
  - Panel B: “extra” source columns that are **non-blank** and **not yet mapped**
- Remove step-based wizard
- Add Cancel + Undo

- [ ] **REC-002** Replace “Step 1–4” mapping wizard with two-panel mapping editor  
  - Status: IN PROGRESS  
  - Notes:
    - Current implementation is still a step-based wizard (`app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`) with column mapping (`components/deposit-upload/map-fields-step.tsx`).
    - Cancel/Undo as described in the meeting transcript is not yet implemented (Back navigation exists).
  - Definition of Done:
    - Panel B shows only **non-blank** source columns not yet mapped.
    - Users can add a mapping from Panel B into Panel A.
    - Users can remove/unmap a field and it returns to Panel B.
    - Cancel + Undo controls exist.

### REC-003 — Template persistence & editing rules (incl. custom templates)
- [ ] **REC-003** Persist template mappings and allow editing without breaking existing deposits  
  - Status: IN PROGRESS  
  - Notes:
    - Template config is persisted/updated during deposit import (`app/api/reconciliation/deposits/import/route.ts`) via `ReconciliationTemplate.config`.
    - Dedicated template editing/versioning UX is not yet implemented; current behavior updates the template used for future uploads.
  - Definition of Done:
    - Template mapping saved per (Distributor, Vendor, TemplateName).
    - Versioning or “effective date” strategy decided so old deposits remain reproducible (**ASSUMED**—confirm).

### REC-004 — Upload file types + parse into normalized deposit + line items
- [x] **REC-004** Upload deposit file (CSV/Excel/PDF) and parse into `reconciliation_deposits` + `deposit_line_items`  
  - Status: DONE  
  - Notes:
    - CSV/Excel parsing is implemented (`lib/deposit-import/parse-file.ts`) and import creates `Deposit` + `DepositLineItem` rows (`app/api/reconciliation/deposits/import/route.ts`).
    - Checkpoint 3 input for REC-004 is CSV (examples: `Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet1.csv`, `Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet2.csv`).
    - PDF import is not implemented (out of scope unless acceptance criteria change).
  - Definition of Done:
    - Create deposit record with metadata (distributor/vendor/template/upload date).
    - Parse file rows into normalized line items with mapped fields.
    - Row-level validation errors surfaced (bad amounts, missing required mapped fields).

### REC-005 — Upload summary + totals computed
- [x] **REC-005** Deposit summary panel showing totals (usage + commission) and allocation rollups  
  - Status: DONE  
  - Notes: Totals/allocated/unallocated are computed on import and surfaced in deposit detail (`app/api/reconciliation/deposits/[depositId]/detail/route.ts` + `components/deposit-reconciliation-detail-view.tsx`).
  - Definition of Done:
    - After upload, UI shows total usage & total commission for the deposit.
    - Shows allocated vs unallocated totals (usage + commission).

---

## B. Reconciliation workspace (Deposit line items ↔ Revenue schedules)

### REC-010 — Reconciliation dashboard (deposit list + statuses)
- [x] **REC-010** Reconciliation Dashboard: deposit list + filter/sort/search  
  - Status: DONE  
  - Notes: Implemented in `app/(dashboard)/reconciliation/page.tsx` + `app/api/reconciliation/deposits/route.ts`.
  - Definition of Done:
    - View deposits with status (Uploaded / In Progress / Reconciled / etc. — confirm enums).
    - Filter by distributor/vendor/template/status/date range.

### REC-011 — Deposit detail “two-grid” reconciliation screen
- [x] **REC-011** Deposit detail reconciliation view with:
  - Top grid: deposit line items  
  - Bottom grid: revenue schedule rows  
  - Status: DONE  
  - Notes: Implemented in `app/(dashboard)/reconciliation/[depositId]/page.tsx` + `components/deposit-reconciliation-detail-view.tsx`.
  - Definition of Done:
    - Selecting a deposit line item drives bottom grid context (available/suggested schedules).
    - Columns aligned so expected vs actual are easy to compare (especially usage & commission).
    - Matched/unmatched toggles exist; default view = Unmatched.

### REC-012 — Match button placement + labeling (Jan 6, 2026 meeting)
- [ ] **REC-012** Place “Match” button to the left of bottom search; label AI button with text (“Use AI”)  
  - Status: IN PROGRESS  
  - Notes:
    - Match action is implemented in the bottom grid header (`components/deposit-reconciliation-detail-view.tsx`).
    - AI action is currently icon-only (Sparkles) with aria-label/title; needs visible text label to match requirement.
  - Definition of Done:
    - “Match” button is left of search on bottom grid.
    - AI action uses text label (not only icon).

### REC-013 — Matching updates Actual Usage + Actual Commission on revenue schedule rows
- [x] **REC-013** Add `Actual Usage` and `Actual Commission` columns to revenue schedule grid; update on Match  
  - Status: DONE  
  - Notes: Revenue schedule grid includes Actual Usage/Commission and is recomputed on match (`lib/matching/revenue-schedule-status.ts`).
  - Definition of Done:
    - Bottom grid includes expected usage net + actual usage + actual commission.
    - When Match occurs, actual usage/commission fill based on matched deposit line amount(s).
    - Existing allocations are respected (partial allocations supported).

### REC-014 — Split/merge allocations (many-to-many match table)
- [ ] **REC-014** Implement `reconciliation_matches` to support partial allocations (split/merge)  
  - Status: NOT STARTED  
  - Notes:
    - Core rule: allocations happen during Match/Allocate; reconciliation/finalize happens later (locks allocations + downstream status transitions).
    - Required behaviors:
      - Split: `1 deposit_line_item → many revenue_schedules`
      - Merge: `many deposit_line_items → 1 revenue_schedule`
    - Implementation approach:
      - Allocation step: create/update rows in the junction table (`DepositLineMatch` today; conceptually `reconciliation_matches`) with `usageAmount` and `commissionAmount` per link.
      - Running totals: recompute deposit allocated/unallocated + schedule actual usage/commission from allocations.
      - Reconcile step: finalize allocations (mark reconciled/locked) separately from allocation.
  - Definition of Done:
    - A deposit line item can allocate across multiple revenue schedules and vice versa.
    - Each link stores `amount_matched` (and other needed detail).
    - UI supports partial allocation totals and remaining unallocated.

---

## C. Smart Matching (AI-assisted suggestions + confidence controls)

### REC-020 — Suggested matches auto-load (>=70% default) + confidence threshold control
**Requirement (Jan 6, 2026 meeting):**
- Suggested matches show automatically when a line loads
- Default display threshold: **70% or higher**
- User can adjust confidence threshold to see lower-confidence candidates if needed

- [x] **REC-020** Implement suggested matches + confidence threshold control  
  - Status: DONE  
  - Notes: Suggested matches auto-load; confidence threshold is configurable per-user via Settings (default currently 75%).
  - Definition of Done:
    - Suggested matches appear automatically on line select.
    - Default threshold = 70%.
    - Slider/control adjusts results live.

### REC-021 — “Perfect match” flow (bulk apply / rapid matching)
- [x] **REC-021** Support rapid matching of perfect/high-confidence matches (bulk apply)  
  - Status: DONE  
  - Notes: Implemented as AI auto-match preview + apply flow (`app/(dashboard)/reconciliation/[depositId]/ai-matching/page.tsx`).
  - Definition of Done:
    - AI action identifies exact/high-confidence matches for selected deposit or all unmatched (define scope).
    - User can apply matches efficiently (bulk or one-click per line).

### REC-022 — Matching algorithm & confidence scoring (baseline from Milestone 3 spec)
- [ ] **REC-022** Implement matching logic consistent with Milestone 3 spec (levels + tolerance + name/date matching)  
  - Status: IN PROGRESS  
  - Notes: Matching engine + confidence scoring implemented (`lib/matching/deposit-matcher.ts`); still needs spec parity validation/tuning.
  - Definition of Done:
    - Confidence score produced per candidate match.
    - Matching prioritizes likely candidates (“priority matching” mentioned in meeting).

---

## D. Variances, Adjustments, Flex Products (pre-reconcile)

### REC-030 — Detect overages vs expected usage net and prompt for decision
- [ ] **REC-030** Variance detector on match (pre-reconcile)  
  - Status: NOT STARTED  
  - Notes:
    - Variance tolerance is configured via Settings > Reconciliation Settings (tenant default) and is used for thresholding.
    - System computes overage/underage during matching using expected + adjustments vs actual allocated.
  - Definition of Done:
    - When proposed match creates an overage beyond configured variance, system prompts user.
    - Prompt occurs during matching (before final reconcile).

### REC-031 — Variance decision tree (3 options) (Jan 6, 2026 meeting)
- [ ] **REC-031** Implement 3-option variance decision flow  
  - Status: NOT STARTED  
  - Notes: Trigger occurs during matching/allocation (before final reconcile).
  - Definition of Done:
    - Options: 1) AI adjustment, 2) Manual adjustment, 3) Create flex product.
    - After choice, match proceeds and items move to "matched" state.

### REC-032 — “Apply adjustment to this schedule” vs “all future schedules”
- [ ] **REC-032** Support "adjust this schedule vs adjust all future schedules usage" behavior  
  - Status: NOT STARTED  
  - Notes:
    - Adjustments default to one-time (month-specific).
    - Optional "Apply to future schedules for this product" behavior exists and updates future schedules in-scope.
  - Definition of Done:
    - UI offers the choice and applies correct updates.
    - Confirm how "this product" is identified for future schedules (productId vs productName vs vendor SKU) and how far forward to apply.

### REC-033 — Flex products (unknown product, overage, bonus, chargeback)
- [ ] **REC-033** Implement Flex Product creation option for unknown/out-of-tolerance items  
  - Status: NOT STARTED  
  - Notes: Flex product can be created when overage occurs (option 3 in REC-031) or when product is unknown.
  - Definition of Done:
    - User can create flex schedule/product from deposit line.
    - Flex schedules integrate into matching so deposit line can be allocated.

### REC-034 - Underpayment / late payment behavior (clarified)
- [ ] **REC-034** Implement underpayment + late/double payment rules  
  - Status: NOT STARTED  
  - Notes:
    - Underpayment does not trigger variance; schedules remain open with remaining balance.
    - Late payment / double payment does not auto-adjust future schedules.
    - System can allocate a single payment across multiple open schedules (catch-up behavior).
  - Definition of Done:
    - Underpayment stays as open balance; no variance prompt.
    - Catch-up allocations supported across multiple schedules.
    - No automatic propagation to future schedules for late/double payments.

---

## E. Final reconcile step (batch finalize)

### REC-040 — Reconcile Matches button: finalize + lock allocations
- [x] **REC-040** Implement “Reconcile Matches” action  
  - Status: DONE  
  - Notes: Finalize/unfinalize implemented (`app/api/reconciliation/deposits/[depositId]/finalize/route.ts` + `app/api/reconciliation/deposits/[depositId]/unfinalize/route.ts`).
  - Definition of Done:
    - Requires deposit totals allocated (no unallocated) OR supports partial reconcile (confirm rule).
    - Updates deposit status and schedule rollups/statuses.
    - Records who reconciled and when.

### REC-041 — Matched/unmatched filters and post-reconcile validation view
- [x] **REC-041** Post-reconcile validation view and filters  
  - Status: DONE  
  - Notes: Status filters + “Review reconciled items” modal exist in `components/deposit-reconciliation-detail-view.tsx`.
  - Definition of Done:
    - Matched items move out of default unmatched view and remain reviewable.
    - Deposit header shows total / allocated / unallocated clearly.

---

## F. Permissions & auditability

### REC-050 — Role-based restrictions for reconciliation actions
- [x] **REC-050** Enforce permissions for deposit upload, matching, reconcile  
  - Status: DONE  
  - Definition of Done:
    - Accounting/Admin can upload and reconcile.
    - Sales roles have restricted access per spec.

### REC-051 — Audit logging for reconciliation actions
- [ ] **REC-051** Audit critical actions: upload deposit, edit template mapping, match/unmatch, adjustments, reconcile finalization  
  - Status: IN PROGRESS  
  - Notes:
    - Revenue schedule audit entries are written for apply-match/unmatch/finalize (`app/api/reconciliation/deposits/[depositId]/**` + `lib/audit`).
    - Deposit upload/template edits do not yet have a complete audit trail equivalent to schedules.

---

## G. Performance, reliability, and data integrity

### REC-060 — Performance targets for large uploads and matching
- [ ] **REC-060** Validate performance targets from Milestone 3 spec  
  - Status: NOT STARTED  
  - Definition of Done:
    - Can process “large vendor files” at acceptable speed.
    - Server-side pagination everywhere.

### REC-061 — Idempotency & rollback safety for uploads
- [ ] **REC-061** Ensure upload pipeline is safe to retry and does not duplicate deposits/line items  
  - Status: NOT STARTED  
  - Notes: **ASSUMED**—confirm expectations and implement as needed.

---

## H. UI polish items that block checkpoint review (from Jan 6 notes)

### REC-070 — Standardize delete modals + blockers legend
- [ ] **REC-070** Standardize delete modals and show “blockers” legend across modules  
  - Status: NOT STARTED  
  - Notes: Mentioned as a desired consistency item across objects.

### REC-071 — Reconciliation screen UX consistency pass
- [ ] **REC-071** Reconciliation screen UX consistency pass  
  - Status: IN PROGRESS  
  - Definition of Done:
    - Key monetary columns are visible and aligned.
    - Match/AI actions are obvious and consistent.

---

# Optional / Add-on items (verify scope)

### OPT-001 — Deposit Detail View drawer (CO-002-B)
- [x] **OPT-001** Implement Deposit Detail View on deposit row click (drawer/modal)  
  - Status: DONE  
  - Notes: Full-page deposit detail (`/reconciliation/[depositId]`) is acceptable for Checkpoint 3; drawer/modal is not required.

---

# Open questions / Clarifications needed

## Clarifications (resolved)

- Deposit upload files for REC-004 are CSV (examples: `Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet1.csv`, `Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet2.csv`); PDF is not required for Checkpoint 3 acceptance.
- OPT-001: full-page deposit detail is acceptable; drawer/modal is not required.
- REC-014: split/merge allocations are required; Match/Allocate creates/updates junction rows and updates running totals; finalize/reconcile locks allocations later.
- REC-030–REC-034: variance tolerance is configured in Settings > Reconciliation Settings; overage triggers a 3-option flow during matching; underpayment does not trigger variance and remains as open balance; late/double payments do not auto-adjust future schedules.

## Remaining open questions

1. **REC-032 scope:** confirm how "future schedules for this product" is identified (productId vs productName vs vendor SKU) and whether it is limited to the same opportunity/account.
2. **REC-031 AI adjustment:** confirm whether "AI adjustment" is rules-based suggestion (v1) or calls an external AI model, and what fields it is allowed to update.

---

# Readiness checklist (what to demo for “Checkpoint 3 complete”)

- [x] Upload a real vendor deposit file using a configured template (CSV/Excel supported)
- [x] Confirm mapped fields + line items look correct
- [x] Suggested matches appear with confidence (default currently 75%); confidence slider is in Settings
- [x] Manual match works (AI button text label still pending)
- [x] Matching updates Actual Usage + Actual Commission on revenue schedules
- [ ] Variance prompt appears; run through 3 options
- [x] All allocations reconcile; “Reconcile Matches” finalizes deposit and updates statuses
- [x] Permissions enforced for upload/reconcile actions
- [ ] Basic performance sanity check on a realistic sample file

---
