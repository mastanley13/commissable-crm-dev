# Plan to Complete `02_04_work_log_ticket_plan_flat.csv`

Last updated: 2026-02-05

## Goal
Turn `docs/02_04_work_log_ticket_plan_flat.csv` into an execution-ready backlog (ready to create/track in Jira/Linear/etc.) by:
- confirming scope + priority,
- filling missing **Assumptions** (16/20 currently blank) and **Dependencies** (20/20 blank),
- grouping the 20 items into work packages with a sensible delivery order,
- defining a lightweight test + release checklist.

## Current snapshot (from the CSV)
- Total items: 20
- Priorities: P0 (1), P1 (11), P2 (8)
- Biggest area: **Revenue Schedules** (11 items) plus **Revenue Schedules / UI** (1)

## Definition of done (for the CSV/backlog)
Each row (WL-001 … WL-020) has:
1. **A single clear outcome** (what changes for the user).
2. **Testable acceptance criteria** (already present, but confirm they’re complete).
3. **Assumptions** filled (what we’re taking as true, or what we’ll decide during implementation).
4. **Dependencies** filled (other WL tickets, data prerequisites, environment prerequisites).
5. **Open questions resolved** (either answered in Description/Assumptions or spun into a follow-up ticket).

Optional but recommended for execution:
- Add columns like `Owner`, `Estimate`, `Status`, `Target Release`, `Jira Key` (if you plan to track delivery outside this CSV).

## Phase 1 — Triage (60–90 minutes)
1. **Confirm priority order** with stakeholders (especially P0/P1):
   - P0: WL-017
   - P1: WL-001, WL-002, WL-006, WL-007, WL-008, WL-010, WL-011, WL-013, WL-014, WL-015, WL-018
2. **Decide “merge vs split”** for larger/overlapping UI work:
   - Revenue Schedule “Create/Clone” tickets overlap heavily (WL-006/007/008/009/010/011/012).
   - Decide if WL-010 is the umbrella (recommended) and the others become subtasks, or if they stay as separate tickets.
3. **Confirm tracking system + formatting**:
   - If importing into Jira, confirm how you want to handle the literal `\n` sequences in Description/Acceptance Criteria (keep as-is vs convert to real newlines).

## Phase 2 — Fill in Assumptions and Dependencies (2–4 hours)
Use these guidelines for consistent entries:

### Assumptions (what to write)
Pick the smallest set that makes the ticket implementable. Examples:
- “Recalculates derived fields immediately after bulk update.”
- “Uses existing Opportunity defaults for split values; no new admin config needed.”
- “UI change only; no data migration required.”
- “Behavior must be consistent across list view + detail view.”

### Dependencies (what to write)
Reference **WL-###** where possible, otherwise name the prerequisite:
- Another ticket that must land first (e.g., “Depends on WL-010 (Clone Schedules redesign)”).
- Test data or environment setup (e.g., “Requires UAT deposit file from WL-001”).
- Admin configuration needed (e.g., “Requires Revenue Type list in Admin to be authoritative”).

### Suggested dependency mapping (starting point)
Adjust after triage, but this is a reasonable first pass:
- **Schedule Create/Clone work package**
  - WL-010 (umbrella) → WL-006, WL-007, WL-008, WL-009, WL-011, WL-012
- **Manage Revenue Schedules + rate changes**
  - WL-013 → WL-014 (layout/list), WL-015 (auto-fill / update UX)
  - WL-016 is independent (draggable modal), but likely touches the same modal framework as WL-013/014
- **Data/QA prerequisite**
  - WL-001 supports validating schedule/deposit matching behavior and should be done early for UAT

## Phase 3 — Execution plan (delivery order)
This is an implementation-oriented ordering that reduces risk and unblocks testing early.

### Package A — “Stop-the-line” correctness + UAT data
1. WL-017 (P0) Catalog percent formatting
2. WL-001 (P1) Add deposit file + explicit match scenarios for UAT validation

### Package B — Revenue Schedules: Create/Clone redesign
Implement WL-010 first, then fold in the related UX/field fixes:
- WL-010 (P1) Replace Create Schedules with Clone behavior + correct prefill
- WL-006 (P1) Two-column form layout
- WL-007 (P1) Remove split inputs; prefill from Opportunity
- WL-011 (P1) Restrict schedule date selection to YYYY-MM (system sets day=1)
- WL-008 (P1) Fix House % default (1.00% vs 100.00%)
- WL-009 (P2) Clarify/remove chargeback toggle; use negative Price Each
- WL-012 (P2) Label/field cleanup + tooltip updates

### Package C — Revenue Schedules: Manage + commission rate changes
- WL-013 (P1) Preserve selections + Select All
- WL-014 (P1) Improve “Apply To” area + bigger schedule list + headers/columns
- WL-015 (P1) Expected rate auto-fills New Commission Rate % + enables Update Rates
- WL-016 (P2) Make management modal draggable

### Package D — Catalog + product creation rules
- WL-018 (P1) Enforce Revenue Type options from Admin list + required House fields
- WL-020 (P2) Default Other–Product Name to House–Product Name; overwrite on deposit match

### Package E — Opportunities + cross-app UI polish
- WL-003 (P2) Opportunity Product Detail shows Opportunity Name link (DONE)
- WL-004 (P2) Opportunity Detail Products section shows first/last schedule dates
- WL-005 (P2) Add Product popup font consistency
- WL-019 (P2) Add dropdown arrows to picklists across system (define exact fields/pages in Assumptions)

## WL-005 (Prep notes)
Likely implementation location:
- `components/opportunity-line-item-create-modal.tsx` (this modal has tabs for “Add Product from Catalog” vs “Create New Product”)

What to verify (to reproduce quickly):
1. Open the modal and compare **House - Product Family** in both tabs:
   - Displayed field value font size/weight
   - Dropdown option list font size/weight (expanded state)
2. Confirm whether the inconsistency is:
   - the field text (input vs select rendering), or
   - the dropdown options list (custom dropdown buttons vs native select menu).

What looks suspicious in code (starting point):
- The inputs/selects use the same `inputCls` (`text-xs`), but the custom dropdown options use `text-sm` buttons (e.g. the “Add Product from Catalog” family/subtype dropdown lists).

Proposed fix approach (keep scope tight to WL-005):
- Standardize the **expanded dropdown option text** to match the field size (likely `text-xs`) for the House Product Family dropdown in the “Add Product from Catalog” tab.
- Re-test the House Product Subtype dropdown right after (same pattern) to ensure it still looks consistent.

QA checklist for WL-005:
- Verify both tabs show the same typography for House Product Family (field + dropdown options).
- Verify no regressions to other dropdowns in the modal (Vendor, Distributor, Product Name).

## Phase 4 — Test checklist (lightweight, but explicit)
- **Regression smoke**
  - Create/Clone schedules for an opportunity with default commission splits
  - Verify schedule date behavior (YYYY-MM selection) and resulting schedule start dates
  - Verify bulk/rate update flows don’t lose selected schedules
- **UAT scenarios (from WL-001)**
  - Overage triggers FLEX/back-office variance handling
  - 2 deposit lines → 1 revenue schedule (2:1)
  - 1 deposit line → 2 revenue schedules (1:2)
- **Catalog correctness**
  - Expected Commission Rate % displays correctly on list + detail + create/edit flows

## Phase 5 — Release notes and rollout
- Bundle by package (A–E) so UAT can validate in waves.
- For broad UI changes (WL-019), confirm scope and consider a feature flag if impact is high.
