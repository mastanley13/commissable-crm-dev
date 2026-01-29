---
title: Sprint Plan — Quick Wins + P0 Execution
source: Master Dev Plan (Meetings Jan 21, 22, 26, 2026)
created: 2026-01-29
---

# Sprint Plan — Quick Wins + P0 Execution

**Goal:** Unblock reconciliation matching and make deposit/reconciliation flows usable end-to-end (upload → map → match → verify → reconcile), focusing on a mix of quick wins and a few more intensive tasks.

**Scope (tasks included):**
- `P0-REC-002` Create missing test revenue schedules (e.g., VoIP) to validate AI matching
- `QA-001` Share manual + automated test checklists (and keep updated)
- `P0-REC-001` Add Account Legal Name as a deposit mapping option (fix “Unknown Account”)
- `P0-UI-005` Set reconciliation default view to Unmatched and remove “Suggested” tab
- `P0-UI-001` Fix commission rate display/calculation issue in reconciliation grid
- `P0-NAV-001` Fix “Go to revenue schedule” link
- `P0-UI-006` Disable auto-selection of the first deposit line item
- `P0-UI-003` Ensure bottom revenue schedule grid filters dynamically based on selected status/context
- `P0-UI-004` Enable multi-select on reconciliation page
- `P0-DEP-001` Add Deposit Verification workflow fields + relabel “Date” → “Report Date”
- `P0-DEP-002` Add ticket fields + relabels
- `P0-MAP-001` Deposit upload mapping UI updates (layout + “Suggested Match” + prevent duplicate maps)
- (Optional if time remains) `P0-MAP-002`, `P0-MAP-003`

**Out of scope (explicitly not in this sprint plan):**
- `P1/P2` items like match-type validation, Flex workflows, chargebacks/collections, multi-vendor upload parsing, migration scaffolding.

## Definition of Done (DoD)

Each completed item must have:
- Acceptance criteria validated against a repeatable smoke dataset.
- A short “How to test” note added to the checklist (or the task description if checklist isn’t ready yet).
- Before/after screenshots for any UI changes that Rob will use in UAT.

## Day 0 — Setup / sanity (same-day)

### Deliverables
- [ ] Repeatable smoke dataset exists (opportunities + schedules + deposit uploads) to validate each change quickly.
- [ ] Baseline screenshots captured for reconciliation UI pain points (scrollbar, auto-select, broken links, default view).
- [ ] `QA-001` checklist published and used as the validation guide for the sprint.

### Tasks
#### `P0-REC-002` (~1–3 hours, High impact)
- [ ] Identify the deposit product lines used in the smoke dataset (including VoIP or any known “missing schedule” categories).
- [ ] Create at least one corresponding revenue schedule per deposit product line.
- [ ] Validate: running Match on a known deposit line produces at least one candidate suggestion.

#### `QA-001` (~1–3 hours, Medium impact)
- [ ] Create/update checklist sections for:
  - [ ] Upload → Map → Reconcile smoke run
  - [ ] Mapping edge cases (bad columns, duplicate maps, required fields)
  - [ ] Reconciliation UX (default view, selection behavior, navigation, filters)
  - [ ] Deposit verification + ticket metadata validations

## Day 1 — Unblock matching + fast UX wins

### Primary objective
Remove “Unknown Account” root cause and make reconciliation immediately less frustrating.

### Tasks
#### `P0-REC-001` (~0.5–1.5 days, High impact)
- [ ] Add “Account Legal Name” to deposit mapping field options.
- [ ] Ensure importer persists the mapped value onto deposit line / normalized deposit record (whatever matching reads).
- [ ] Ensure matching uses Account Legal Name to find candidate schedules when present.
- [ ] Validate (smoke dataset):
  - [ ] Known account names map to correct accounts (no “Unknown Account”).
  - [ ] Match produces candidates where schedules exist.

#### Quick wins bundle (pick 2–4 same day)
- `P0-UI-005` (~1–4 hours, Med–High impact)
  - [ ] Default reconciliation view loads as “Unmatched”.
  - [ ] “Suggested” tab removed/hidden per plan.
- `P0-UI-006` (~1–2 hours, Medium impact)
  - [ ] Reconciliation does not auto-select first deposit line on load.
- `P0-NAV-001` (~1–3 hours, Medium impact)
  - [ ] “Go to revenue schedule” link routes correctly for representative schedules.
- `P0-UI-001` (~2–6 hours, High impact)
  - [ ] Commission rate display/calculation is correct for common schedule types in the dataset.

## Day 2 — Reconciliation correctness + usability (medium tasks)

### Tasks
#### `P0-UI-003` (~0.5–2 days, High impact)
- [ ] Bottom schedule grid reflects the selected deposit line + status context.
- [ ] Filters update dynamically (no stale results when selection/status changes).
- [ ] Validate with at least 3 scenarios:
  - [ ] Unmatched deposit line
  - [ ] Matched / reconciled deposit line
  - [ ] Switching between deposit lines preserves expected filter behavior

#### `P0-UI-004` (~1–2 days, High impact)
- [ ] Multi-select enabled on reconciliation page.
- [ ] Intended interactions defined and validated:
  - [ ] Multi-select deposit line items (with clear selection state).
  - [ ] Bulk action (if applicable) behaves as expected or is explicitly disabled with explanation.
  - [ ] No accidental reconciliation/match actions due to multi-select state.

## Day 3 — Deposit verification + ticket metadata (P0 completeness)

### Tasks
#### `P0-DEP-001` (~0.5–1.5 days, High impact)
- [ ] Add deposit verification workflow fields per master plan.
- [ ] Relabel “Date” → “Report Date”.
- [ ] Validate:
  - [ ] Fields show on deposit record where intended.
  - [ ] Required fields enforced (if specified).
  - [ ] Data persists correctly.

#### `P0-DEP-002` (~0.5–1.5 days, Med–High impact)
- [ ] Add ticket fields: Vendor Ticket ID, Vendor Contact, Created By.
- [ ] Relabel “Ticket ID” → “House Ticket Number”.
- [ ] Validate:
  - [ ] Fields visible in the correct UI context(s).
  - [ ] Data persists and is searchable/filterable if intended.

## Day 4–5 — “More intensive” mapping improvements (high leverage)

### Tasks
#### `P0-MAP-001` (~1–3 days, High impact)
- [ ] UI layout improvements (table height/layout) to reduce scrolling/friction.
- [ ] “Suggested Match” improvements (as defined in master plan).
- [ ] Prevent duplicate maps (hard validation).
- [ ] Validate:
  - [ ] Mapping cannot proceed with duplicate field mappings.
  - [ ] Common templates map cleanly on the first pass.
  - [ ] Suggested Match UI does not block manual mapping.

### Optional (only if `P0-MAP-001` is stable and time remains)
- `P0-MAP-002` (~1–2 days, Medium impact): mapping review restyle (tabs, layout, remove sample rows, row count).
- `P0-MAP-003` (~0.5–2 days, Medium impact): merge “Review” step into main field mapping page.

## Validation checklist (minimum per PR/change)

- [ ] Run smoke dataset end-to-end: upload → map → match → verify → reconcile.
- [ ] Confirm “Unknown Account” does not occur when Account Legal Name exists.
- [ ] Confirm at least one deposit line generates match candidates.
- [ ] Confirm default reconciliation landing state is Unmatched and does not auto-select a line.
- [ ] Confirm navigation to revenue schedule works from reconciliation.
- [ ] Capture before/after screenshots for each UI change.

## Suggested sequencing rules (to keep momentum)

- Always prioritize unblockers first: `P0-REC-002` → `P0-REC-001`.
- Batch small UX fixes together after unblockers to quickly improve UAT experience.
- Do not start `P0-MAP-001` until end-to-end smoke flow is passing for reconciliation matching.

