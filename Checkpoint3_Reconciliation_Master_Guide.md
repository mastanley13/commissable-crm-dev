# Checkpoint 3 (Reconciliation) — Master Build Guide & Checklist

**Project:** Commissable CRM  
**Checkpoint:** 3 — Reconciliation  
**Doc purpose:** A single source-of-truth checklist your coding agent can use to track progress, surface gaps, and verify “ready for review” for Checkpoint 3.  
**Last updated:** 2026-01-13

---

## How to use this document

1. Treat each top-level checkbox item (e.g., `REC-010`) as a ticket/epic.
2. Update progress by:
   - Changing `- [ ]` → `- [x]` when complete.
   - Using the `Status:` line (NOT STARTED / IN PROGRESS / BLOCKED / DONE).
   - Adding notes under `Notes:` with links to PRs, screenshots, or open questions.
3. If you discover ambiguity, add it to **Open Questions / Clarifications Needed**.
4. If you implement something not explicitly specified in the sources, label it **ASSUMED** in Notes.

---

## Progress summary (as of 2026-01-13)

- **DONE (implemented):** Deposit list + deposit detail reconciliation screen; CSV/Excel deposit import; template auto-seeding + mapping persistence; suggested matches + confidence filtering; manual allocate/unallocate; AI auto-match preview/apply; partial allocations (split/merge) via match junction table; variance detection + 3-option flow (AI adjustment preview, manual adjustment, flex product); optional “apply to future schedules” behavior (scoped); flex products + chargebacks; finalize/unfinalize; revenue schedule actuals updated; baseline RBAC.
- **IN PROGRESS:** Template selection UX (explicit distributor+vendor+template); mapping UI redesign (two-panel + cancel/undo); matching algorithm parity/tuning vs Milestone 3 spec; audit coverage completeness (upload + template edits); reconciliation UX polish (blockers legend/delete modals consistency).
- **NOT STARTED:** Performance targets validation; upload idempotency/retry hardening.

---

## Scope definition for Checkpoint 3

Checkpoint 3 centers on delivering an end-to-end **deposit ingestion + reconciliation workflow**:
- Upload deposit files and map vendor/distributor file columns into normalized deposit line items
- Review deposit line items and **match/allocate** them to revenue schedules (AI-assisted + manual)
- Handle **variances / adjustments** and **Flex Products** (unknown product, overage/bonus/chargeback) before final “reconcile”
- Track “matched vs unmatched” and ensure allocations roll up correctly in UI totals

> “Checkpoint 3 is top priority… focusing on reconciliation…”【91:3†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L1-L22】

---

## Primary source references

Use these documents when deciding requirements and acceptance criteria:

1. **Meeting transcript summary — Jan 6, 2026** (Checkpoint 3 priority + UI/AI requirements)  
   - Deposit mapping UI redesign, cancel/undo【91:4†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L10-L41】  
   - AI matching workflow + confidence control【91:5†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L40-L111】  
   - Match button placement + “actual usage/commission” behavior【228:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L36-L59】  
   - Variance / adjustment decision tree + “flex product” option【228:7†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L1-L46】  
   - Next steps list for V1 reconciliation workflow + UI polish【91:6†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L38-L63】

2. **Milestone 3 — Revenue & Reconciliation Specifications** (baseline functional spec)  
   - File: `Revenue Reconciliation Specifications - Milestone 3.pdf` (11 pages)  
   - **Note:** This PDF appears to be image-based; use page numbers in this doc when verifying UI and business rules.  
   - Link: fileciteturn5file0

3. **Data Notebook (Schema/relationship guidance)**  
   - Split/merge mapping via `reconciliation_matches` between `deposit_line_items` and `revenue_schedules`【228:8†Data Notebook LM 1.1.docx†L63-L69】  
   - Link: fileciteturn8file1

4. **Change Order CO-002-B (optional / add-on)** — Deposit Detail View enhancement  
   - Deposit row click opens detail with commission period, account, vendor, etc.【103:0†CO-002-Commissable-CRM-Change-Order-12-4-25.docx†L13-L31】  
   - Link: fileciteturn4file0

---

## Architecture notes (data model)

### Required relationships (baseline)

- `reconciliation_deposits` → many `deposit_line_items`
- `deposit_line_items` ↔ `revenue_schedules` is **many-to-many** via `reconciliation_matches` with `amount_matched` (supports split/merge allocations)【228:8†Data Notebook LM 1.1.docx†L63-L69】

> ⚠️ Potential conflict: the older ERD mermaid file includes `DEPOSIT_LINE_ITEM.ScheduleID` (1 line → 1 schedule).  
> The newer data notebook expects M:N via `reconciliation_matches`【228:11†Data Notebook LM 1.1.docx†L9-L11】.  
> **Update:** Implemented M:N allocations via `DepositLineMatch` (junction table) with per-link `usageAmount` and `commissionAmount`.

---

# Build checklist

## A. Deposit file ingestion & mapping (Templates + Upload + Parse)

### REC-001 — Deposit Template selection: Distributor → Vendor → Template
- [ ] **REC-001** Deposit upload flow requires selecting **Distributor + Vendor + Template** before upload  
  - Status: IN PROGRESS  
  - Notes:
    - Distributor + Vendor are required before proceeding in the upload flow (`components/deposit-upload/create-template-step.tsx`).
    - Template is currently inferred/seeded for a (Distributor, Vendor) pair (`app/api/reconciliation/templates/route.ts`) rather than explicitly selected in the UI.
  - DoD:
    - UI forces selection of all three before file chooser is enabled.
    - Selected template drives mapping rules.

### REC-002 — Deposit mapping UI redesign (two-panel; remove “Step 1–4 wizard”)
> Requirement: Mapping UI should show **“known fields”** (standard fields we map into) and a second panel of **“extra fields that are non-blank and not yet mapped”**; remove current step-based wizard; add Cancel + Undo【91:4†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L10-L41】

- [ ] **REC-002** Replace "Step 1-4" mapping wizard with two-panel mapping editor  
  - Status: IN PROGRESS  
  - Notes:
    - Current implementation is still a step-based wizard (`app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`) with column mapping (`components/deposit-upload/map-fields-step.tsx`).
    - Cancel/Undo as described in the meeting transcript is not yet implemented (Back navigation exists).
  - DoD:
    - Panel A: standard/known destination fields (usage, commission, customer, product, etc.).
    - Panel B: shows only **non-blank** source columns not yet mapped【91:4†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L14-L28】.
    - Users can add a mapping from Panel B into Panel A.
    - Users can remove/unmap a field and it returns to Panel B.
    - Cancel + Undo controls exist【91:4†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L33-L41】.

### REC-003 — Template persistence & editing rules (incl. custom templates)
- [ ] **REC-003** Persist template mappings and allow editing without breaking existing deposits  
  - Status: IN PROGRESS  
  - Notes:
    - Template config is persisted/updated during deposit import (`app/api/reconciliation/deposits/import/route.ts`) via `ReconciliationTemplate.config`.
    - Dedicated template editing/versioning UX is not yet implemented; current behavior updates the template used for future uploads.
  - DoD:
    - Template mapping saved per (Distributor, Vendor, TemplateName).
    - Versioning or “effective date” strategy decided so old deposits remain reproducible (**ASSUMED**—confirm with team).

### REC-004 - Upload file types + parse into normalized deposit + line items
- [x] **REC-004** Upload deposit file (CSV/Excel/PDF) and parse into `reconciliation_deposits` + `deposit_line_items`  
  - Status: DONE  
  - Notes:
    - CSV/Excel parsing is implemented (`lib/deposit-import/parse-file.ts`) and import creates `Deposit` + `DepositLineItem` rows (`app/api/reconciliation/deposits/import/route.ts`).
    - Checkpoint 3 input for REC-004 is CSV (examples: `Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet1.csv`, `Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet2.csv`).
    - PDF import is not implemented (out of scope unless acceptance criteria change).
  - DoD:
    - Create deposit record with metadata (distributor/vendor/template/upload date).
    - Parse file rows into normalized line items with mapped fields.
    - Row-level validation errors surfaced (bad amounts, missing required mapped fields).

### REC-005 - Upload summary + totals computed
- [x] **REC-005** Deposit summary panel showing totals (usage + commission) and allocation rollups  
  - Status: DONE  
  - Notes:
    - Totals/allocated/unallocated are computed on import (`app/api/reconciliation/deposits/import/route.ts`) and surfaced in deposit detail (`app/api/reconciliation/deposits/[depositId]/detail/route.ts` + `components/deposit-reconciliation-detail-view.tsx`).
  - DoD:
    - After upload, UI shows total usage & total commission for the deposit.
    - Shows allocated vs unallocated totals (both usage + commission).

---

## B. Reconciliation workspace (Deposit line items ↔ Revenue schedules)

### REC-010 — Reconciliation dashboard (deposit list + statuses)
- [x] **REC-010** Reconciliation Dashboard: deposit list + filter/sort/search  
  - Status: DONE  
  - Notes: Implemented in `app/(dashboard)/reconciliation/page.tsx` + `app/api/reconciliation/deposits/route.ts`.
  - DoD:
    - View deposits with status (Uploaded / In Progress / Reconciled / etc. - confirm exact enums).
    - Filter by distributor/vendor/template/status/date range.

### REC-011 — Deposit detail “two-grid” reconciliation screen
> Requirement: reconcile screen includes top/bottom grids that align key money columns, with “Match” action driven by selecting items and matching【228:4†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L25-L33】

- [x] **REC-011** Deposit detail reconciliation view with:
  - Top grid: deposit line items  
  - Bottom grid: revenue schedule rows  
  - Status: DONE  
  - Notes: Implemented in `app/(dashboard)/reconciliation/[depositId]/page.tsx` + `components/deposit-reconciliation-detail-view.tsx`.
  - DoD:
    - Selecting a deposit line item drives bottom grid context (available/suggested schedules).
    - Columns aligned so expected vs actual are easy to compare (esp. usage & commission)【228:4†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L52-L60】.
    - Matched/unmatched toggles exist; default view = Unmatched【228:2†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L57-L58】.

### REC-012 - Match button placement + labeling
- [x] **REC-012** Place "Allocate" button to the left of bottom search; label AI button with text (not only icon)  
  - Status: DONE  
  - Notes:
    - Allocate action is implemented in the bottom grid header (`components/deposit-reconciliation-detail-view.tsx`).
    - AI action now includes visible text label ("Use AI") rather than icon-only.
  - Evidence/DoD:
    - “Match” button is left of search on bottom grid【228:4†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L4-L5】.
    - AI action uses text label (“Use AI”) rather than only an icon【228:4†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L10-L12】.

### REC-013 — Matching updates Actual Usage + Actual Commission on revenue schedule rows
> Action item: Add Actual Usage + Actual Commission to bottom grid; populate/update on Match【228:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L36-L59】

- [x] **REC-013** Add `Actual Usage` and `Actual Commission` columns to revenue schedule grid; update on Match  
  - Status: DONE  
  - Notes:
    - Revenue schedule grid includes Actual Usage/Commission (`app/(dashboard)/revenue-schedules/page.tsx`).
    - Applying matches recomputes actuals and status (`app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts` + `lib/matching/revenue-schedule-status.ts`).
  - DoD:
    - Bottom grid includes expected usage net + actual usage + actual commission.
    - When Match occurs, actual usage/commission fill based on matched deposit line amount(s)【228:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L54-L59】.
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
  - DoD:
    - A deposit line item can allocate across multiple revenue schedules and vice versa【228:11†Data Notebook LM 1.1.docx†L9-L11】.
    - Each link stores `amount_matched` and (ASSUMED) matched_usage vs matched_commission if needed.
    - UI supports seeing partial allocation totals and remaining unallocated.

---

## C. Smart Matching (AI-assisted suggestions + confidence controls)

### REC-020 — Suggested matches auto-load (>=70% default) + confidence threshold control
> “Suggested… show 70% or higher… adjust the confidence…”【228:5†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L7-L13】

- [x] **REC-020** Show suggested matches automatically when opening a line item, filtered to ≥70% by default  
  - Status: DONE  
  - Notes:
    - Suggested matches auto-load on line selection via candidates API (`app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts`).
    - Threshold is configurable per-user via settings (default currently 75%) (`components/reconciliation-settings-form.tsx` + `lib/matching/user-confidence-settings.ts`).
  - DoD:
    - On line select, suggested matches appear without extra clicks.
    - Default filter shows only matches at/above threshold (initially 70%)【228:5†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L7-L10】.
    - User can adjust threshold to reveal lower-confidence candidates if a schedule is missing【228:5†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L8-L11】.

### REC-021 — “Perfect match” flow (bulk apply / rapid matching)
- [x] **REC-021** Support rapid matching of perfect/high-confidence matches (bulk apply)  
  - Status: DONE  
  - Notes: Meeting implies an ideal “click AI, see perfect matches, then click them” workflow【228:2†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L45-L48】  
  - DoD:
    - AI action identifies exact/high-confidence matches for selected deposit or for all unmatched (define scope).
    - User can apply matches efficiently (bulk or sequential one-click).

### REC-022 — Matching algorithm & confidence scoring
- [ ] **REC-022** Implement matching logic consistent with Milestone 3 spec (levels + tolerance + name/date matching)  
  - Status: IN PROGRESS  
  - Notes:
    - Matching engine + confidence scoring implemented (`lib/matching/deposit-matcher.ts`) with tenant variance tolerance and per-user confidence thresholds; still needs spec parity validation/tuning.
    - Use Milestone 3 specs PDF as baseline for matching rules (pages ~7). fileciteturn5file0  
    - Meeting mentions tolerance/variance and priority matching. Confirm exact thresholds with Rob【228:5†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L12-L14】  
  - DoD:
    - Confidence score produced per candidate match.
    - Matching prioritizes most likely candidates and supports “priority matching” order.

> **ASSUMED**: Model approach (rules-based vs LLM) is not specified in transcript; implement rules-based first unless directed.

---

## D. Variances, Adjustments, Flex Products (pre-reconcile)

### REC-030 — Detect overages vs expected usage net and prompt for decision
> If actual usage > expected usage net, system should flag difference and prompt action; options include AI adjustment, manual adjustment, or creating a flex product【228:7†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L30-L36】

- [ ] **REC-030** Variance detector on match (pre-reconcile)  
  - Status: NOT STARTED  
  - Notes:
    - Variance tolerance is configured via Settings → Reconciliation Settings (tenant default) and is used for thresholding.
    - System computes overage/underage during matching using expected + adjustments vs actual allocated.
  - DoD:
    - When a proposed match produces an overage beyond the configured variance limit, UI prompts the user.
    - Prompt occurs **before** final “Reconcile Matches” (i.e., during matching)【228:7†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L41-L46】.

### REC-031 — Variance decision tree (3 options)
> Option 1 “Make adjustment” (AI), option 2 “Manual adjustment”, option 3 “Create a flex product”【228:5†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L36-L41】

- [ ] **REC-031** Implement 3-option decision flow on variance  
  - Status: NOT STARTED  
  - Notes:
    - Trigger occurs during matching/allocation (before final reconcile).
  - DoD:
    - User can choose:
      1) AI-driven adjustment suggestion  
      2) Manual adjustment entry  
      3) Create flex product  
    - After action, the match proceeds and items move to “matched” state【228:7†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L34-L46】.

### REC-032 — “Apply adjustment to this schedule” vs “all future schedules”
- [ ] **REC-032** Support “adjust this schedule vs adjust all future schedules usage” behavior  
  - Status: NOT STARTED  
  - Notes:
    - Adjustments default to one-time (month-specific).
    - Optional “Apply to future schedules for this product” behavior exists and updates future schedules in-scope.
    - Transcript mentions the choice: “adjust this one, adjust all future schedules usage, or create a flex product…”【228:7†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L34-L36】  
  - DoD:
    - Implement UI choice and apply correct updates to revenue schedules.
    - Confirm how “this product” is identified for future schedules (productId vs productName vs vendor SKU) and how far forward to apply.

### REC-033 — Flex products (unknown product, overage, bonus, chargeback)
- [ ] **REC-033** Implement Flex Product creation option for unknown products / out-of-tolerance items  
  - Status: NOT STARTED  
  - Notes:
    - Flex product can be created when overage occurs (option 3 in REC-031) or when product is unknown.
    - Meeting: unknown product line items can be recorded by creating a flex product; tolerance example 10%【224:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L46-L50】  
    - Milestone 3 spec defines flex types and schedule date rules (see PDF). fileciteturn5file0  
  - DoD:
    - User can create flex schedule/product from deposit line.
    - Flex schedules integrate into matching so the deposit line can be allocated.

### REC-034 — Underpayment / late payment behavior (clarified)
- [ ] **REC-034** Implement underpayment + late/double payment rules  
  - Status: NOT STARTED  
  - Notes:
    - Underpayment does not trigger variance; schedules remain open with remaining balance.
    - Late payment / double payment does not auto-adjust future schedules.
    - System can allocate a single payment across multiple open schedules (catch-up behavior).
    - Transcript: “There’s only overages… Under doesn’t matter.”【228:5†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L49-L50】  
    - Milestone 3 spec includes underpayment flex type (FLEX-U) (see PDF). fileciteturn5file0  
  - DoD:
    - Underpayment stays as open balance; no variance prompt.
    - Catch-up allocations supported across multiple schedules.
    - No automatic propagation to future schedules for late/double payments.

---

## E. Final reconcile step (batch finalize)

### REC-040 — Reconcile Matches button: finalize + lock allocations
> “When you click Reconcile Matches, it does all the work.”【228:7†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L44-L46】

- [x] **REC-040** Implement “Reconcile Matches” action that finalizes deposit reconciliation  
  - Status: DONE  
  - Notes: Finalize/unfinalize implemented (`app/api/reconciliation/deposits/[depositId]/finalize/route.ts` + `app/api/reconciliation/deposits/[depositId]/unfinalize/route.ts`) and wired in `components/deposit-reconciliation-detail-view.tsx`.
  - DoD:
    - Requires deposit totals allocated (no unallocated) OR supports partial reconcile (confirm desired rule).
    - Updates deposit status and schedule statuses/rollups accordingly.
    - Produces audit trail (who reconciled, when).

### REC-041 — Matched/unmatched filters and post-reconcile validation view
- [x] **REC-041** Post-reconcile validation view and filters  
  - Status: DONE  
  - Notes: Status filters + “Review reconciled items” modal exist in `components/deposit-reconciliation-detail-view.tsx`.
  - DoD:
    - Matched items move out of default unmatched view and can be reviewed in matched view【228:7†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L38-L41】.
    - Deposit header shows total / allocated / unallocated clearly.

---

## F. Permissions & auditability

### REC-050 — Role-based restrictions for reconciliation actions
- [x] **REC-050** Enforce permissions for deposit upload, matching, reconcile  
  - Status: DONE  
  - Notes: Milestone 3 spec defines role restrictions; validate against global RBAC approach. fileciteturn5file0  
  - DoD:
    - Accounting/Admin can upload and reconcile.
    - Sales roles have restricted access (view-only or no access as specified).

### REC-051 — Audit logging for reconciliation actions
- [ ] **REC-051** Audit critical actions: upload deposit, edit template mapping, create match/unmatch, adjustments, reconcile finalization  
  - Status: IN PROGRESS  
  - Notes:
    - Revenue schedule audit entries are written for apply-match/unmatch/finalize (`app/api/reconciliation/deposits/[depositId]/**` + `lib/audit`).
    - Deposit upload/template edits do not yet have a complete audit trail equivalent to schedules.

---

## G. Performance, reliability, and data integrity

### REC-060 — Performance targets for large uploads and matching
- [ ] **REC-060** Validate reconciliation performance targets from Milestone 3 spec  
  - Status: NOT STARTED  
  - DoD:
    - System can handle “large vendor files” (see spec) with acceptable timings.
    - Server-side pagination everywhere; avoid client rendering issues.

### REC-061 — Idempotency & rollback safety for uploads
- [ ] **REC-061** Ensure upload pipeline is safe to retry and does not duplicate deposits/line items  
  - Status: NOT STARTED  
  - Notes: **ASSUMED** implementation details; align with contract posture for row-level error logs/retry queues when possible.

---

## H. UI polish items that block checkpoint review (from Jan 6 notes)

### REC-070 — Standardize delete modals + blockers
- [ ] **REC-070** Standardize delete modals and show “blockers” legend across modules  
  - Status: NOT STARTED  
  - Notes: Mentioned as already in-progress and should be consistent across objects【228:12†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L7-L10】  

### REC-071 — Reconciliation screen UX polish
- [ ] **REC-071** Reconciliation screen UX consistency pass  
  - Status: IN PROGRESS  
  - DoD:
    - Match button placement and AI label done (REC-012).
    - Table headers aligned; no truncation of key monetary columns (ASSUMED).

---

# Optional / Add-on items (verify scope)

### OPT-001 — Deposit Detail View drawer (CO-002-B)
- [x] **OPT-001** Implement Deposit Detail View on deposit row click (drawer/modal)  
  - Status: DONE  
  - Notes: Full-page deposit detail (`/reconciliation/[depositId]`) is acceptable for Checkpoint 3; drawer/modal is not required.
  - Notes: This appears in change order CO-002-B; confirm whether it is required for Checkpoint 3 acceptance【103:0†CO-002-Commissable-CRM-Change-Order-12-4-25.docx†L13-L31】.

---

# Open questions / Clarifications needed (add as discovered)

> Add new questions here immediately when you find ambiguity.

## Clarifications (resolved)

- Deposit upload files for REC-004 are CSV (examples: `Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet1.csv`, `Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet2.csv`); PDF is not required for Checkpoint 3 acceptance.
- OPT-001: full-page deposit detail is acceptable; drawer/modal is not required.
- REC-014: split/merge allocations are required; Match/Allocate creates/updates junction rows and updates running totals; finalize/reconcile locks allocations later.
- REC-030–REC-034: variance tolerance is configured in Settings > Reconciliation Settings; overage triggers a 3-option flow during matching; underpayment does not trigger variance and remains as open balance; late/double payments do not auto-adjust future schedules.

## Remaining open questions

- **REC-032 scope:** confirm how "future schedules for this product" is identified (productId vs productName vs vendor SKU) and whether it is limited to the same opportunity/account.
- **REC-031 AI adjustment:** confirm whether "AI adjustment" is rules-based suggestion (v1) or calls an external AI model, and what fields it is allowed to update.

## Historical questions (now resolved)

1. **Split/merge requirement confirmation:** Is M:N matching required in the current checkpoint (Data Notebook says yes) or can we ship 1:1 first?【228:11†Data Notebook LM 1.1.docx†L9-L11】  
2. **Variance limit definition:** Where is the variance configured (global setting? per vendor template? per user)? Transcript says it exists “in the background”【228:5†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L52-L54】.  
3. **“Adjust all future schedules” scope:** future schedules for what entity (same opportunity, same product, same customer account)?【228:7†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L34-L36】  
4. **Underpayment handling:** Meeting says “under doesn’t matter,” but spec includes FLEX-U. Decide policy and document.  
5. **Deposit file formats:** Confirm which vendors/templates must work first (e.g., Telarus-Lingo, Avant-Generic) and whether PDF is truly required for checkpoint acceptance.

---

# Readiness checklist (what to demo for “Checkpoint 3 complete”)

- [x] Upload a real vendor deposit file using a configured template (CSV/Excel supported)
- [x] Confirm mapped fields + line items look correct
- [x] Suggested matches appear with confidence (default currently 75%); confidence slider is in Settings
- [x] Manual match works (AI button text label still pending)
- [x] Matching updates Actual Usage + Actual Commission on revenue schedules
- [ ] Variance prompt appears when expected vs actual differs; run through 3 options
- [x] All allocations reconcile; “Reconcile Matches” finalizes deposit and updates statuses
- [x] Permissions enforced for upload/reconcile actions
- [ ] Basic performance sanity check on a “large enough” sample file (size to confirm)

---
