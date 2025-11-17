% Bulk Actions UI Overhaul and Select‑All Editing – Plan and Estimates

Owner: Engineering
Scope: All list views that show a bulk‑actions bar today (Accounts, Contacts, Opportunities, Groups, Products, Revenue Schedules)

## Overview
- Goal 1: Replace the bottom "slim bar" bulk actions UI with a design that users notice and that does not hide behind the fold.
- Goal 2: Add a convenient way to edit one field and apply the same change to all selected rows (example: Revenue Schedules – quantity, price each, expected commission rate).
- This plan proposes options for both goals with per‑option estimates so we can pick a path and phase delivery.


## Idea 1: Bulk Actions UI Overhaul

Recommended approach: Right‑Side "Bulk Actions Panel" that is visible, optionally draggable/resizable, and reusable across modules.

What exists now
- Bottom overlay components: `components/*-bulk-action-bar.tsx` (fixed at bottom, easy to miss).
- Shared guidance doc: `bulk-action-bar-overlay-guide.md`.

Design options (choose one)
- Option A – Right‑Side Panel (recommended)
  - A panel slides in from the right when 1+ rows are selected.
  - Contains selected count, actions, and contextual tips; persists while scrolling.
  - Draggable and resizable by a small handle; remembers size per page via localStorage.
  - Accessibility: focus trap + ESC to dismiss selection.
- Option B – Top Sticky Action Bar
  - A full‑width bar just under the list header that pushes content down.
  - Very visible; simplest to implement; no drag/resize.
- Option C – Floating Toolbar (top‑right of table)
  - A compact floating card that docks near the table header; expands on hover.
  - Less intrusive than B, more noticeable than the current bottom bar.

Implementation steps (Option A – Right‑Side Panel)
1) Build shared `BulkActionsPanel` component (draggable/resizable panel)
   - Props: `entity:"Account|Contact|..."`, `count:number`, `actions: Action[]`, `onClose()`, optional children for contextual tools (e.g., bulk edit fields).
   - Add small utilities for drag/resize without new deps, or use a tiny library if approved.
2) Replace per‑module bars
   - Update: `components/account-bulk-action-bar.tsx`, `contact-bulk-action-bar.tsx`, `opportunity-bulk-action-bar.tsx`, `product-bulk-action-bar.tsx`, `revenue-schedules-bulk-action-bar.tsx`, `activity-bulk-action-bar.tsx`, `group-bulk-action-bar.tsx` to render the panel.
   - Keep the existing API shape (onSoftDelete/onExport/etc.).
3) Persist panel state
   - Remember size/position per page key. Fall back to a sensible default.
4) A11y/UX polish
   - Focus management, keyboard shortcuts (ESC clears selection), and responsive behavior.

Estimates (per option)
- Option A – Right‑Side Panel: 1.75–2.5 days (shared component 1.0–1.5, wire all modules 0.5–0.75, polish 0.25).
- Option B – Top Sticky Bar: 0.6–0.9 day (single shared bar + swap per module).
- Option C – Floating Toolbar: 0.9–1.3 days (positioning + scroll/resize edge cases).

Notes
- We can ship Option B as a fast, low‑risk interim and follow with A later.
- All options keep existing action handlers; no backend change required.


## Idea 2: Select‑All Editing (apply a single edit to many)

Goal: When multiple rows are selected, allow editing one value and applying it to every selected row with an explicit Apply action.

Two implementation variants
- Variant 2A – Bulk Edit Panel (paired with the panel from Idea 1)
  - When rows are selected, the panel shows a "Bulk Edit" section containing whitelisted editable fields for that table.
  - User enters a value for one field (e.g., Revenue Schedules: `quantity`, `priceEach`, `expectedCommissionRatePercent`) and clicks Apply; backend performs a transactional bulk update.
  - Pros: clear, auditable, minimal table chrome change. Cons: one step away from the cell.
- Variant 2B – In‑Cell "Fill‑Down" with Apply to Selected
  - When multiple rows are selected and the user edits a cell in an editable column, a small inline pill appears near the cell: `Apply to N selected`.
  - Clicking the pill applies the same value to all selected rows and performs a bulk update.
  - Pros: very fast; directly uses the cell. Cons: higher table complexity and more edge cases.

Backend requirements (both variants)
- New bulk update endpoints per module as needed. Start with Revenue Schedules:
  - `POST /api/revenue-schedules/bulk-update` with body `{ ids: string[], patch: { quantity?: number, unitPrice?: number, expectedCommissionPercent?: number } }`.
  - Server applies updates to the correct tables:
    - quantity and unitPrice map to `OpportunityProduct` for each schedule (if present);
    - expectedCommissionPercent maps to `Product.commissionPercent` only when we explicitly choose to override per schedule (recommended: store a schedule‑level override column, otherwise we will edit many products unintentionally).
  - Returns `updated:number`, `failed:string[]`, and a list of validation errors.
- RBAC: require module‑specific bulk permissions (`*.manage` or `*.update` + bulk flag).
- Audit logging: emit `AuditAction.Update` entries with `{ field, from, to }` snapshot per row.

Frontend changes
- Shared: add a lightweight `useBulkSelection` and `useBulkEdit` helpers for storing selected IDs and the current bulk edit draft (field → value).
- Variant 2A – Panel UI
  - Add `BulkEditFields` sub‑component with per‑field input types (number, money, percent). Disable Apply until a valid change exists.
  - After success, refresh the table and clear selection or keep selection based on user choice.
- Variant 2B – In‑cell UI
  - Extend `DynamicTable` to support an `editableColumns` map with editor renderers and validation.
  - When selection count > 1 and a user commits an edit, raise `onCellBulkCandidate({ columnId, value, selectedIds })`.
  - Render a small confirm pill anchored to the cell; on confirm, call the bulk endpoint; show toasts and refresh.

Estimates
- Shared groundwork (hooks + toasts + wiring): 0.4–0.6 day.
- Backend bulk endpoint for Revenue Schedules (incl. audit + RBAC): 0.9–1.2 days.
- Variant 2A – Panel UI: 0.6–0.9 day.
- Variant 2B – In‑cell UI: 1.4–2.0 days (table editing affordances + anchoring + edge cases).
- Optional additional modules (per table type): +0.4–0.7 day each for endpoint + UI wiring.

Recommendation
- Start with Variant 2A (lower risk, ships faster) alongside Idea 1 Option A.
- Add Variant 2B later for the most edited tables if usability testing shows strong value.


## Milestones and Deliverables
- M1 (UI skeleton): Choose Idea 1 option; implement the shared component; swap one module (e.g., Accounts) as a pilot. 0.6–1.5 days depending on option.
- M2 (Revenue Schedules bulk edits): Build bulk endpoint + panel UI (Variant 2A). 1.3–2.1 days.
- M3 (Rollout all bulk panels): Swap remaining modules to the new panel; document usage. 0.8–1.1 days.
- M4 (Optional fill‑down): Implement Variant 2B for Revenue Schedules after feedback. 1.4–2.0 days.


## Acceptance Criteria
- Bulk actions UI is clearly visible and does not obscure content; persists on scroll; keyboard accessible.
- Selection count and core actions (delete/export/owner/status) are available in the new UI for all list pages.
- For Revenue Schedules, bulk editing quantity/price/commission works on N selected rows with server‑side validation and audit logs.
- Errors report per‑row failures without blocking successful updates.
- No disruptive layout shifts or overlapping with modals.


## Risks and Mitigations
- Product commission edits via schedules could unintentionally update many products. Mitigate by scoping commission edits to a schedule‑level override (preferred) or protecting product‑level edits behind an explicit checkbox.
- In‑cell fill‑down can be error‑prone. Start with panel‑based edits (Variant 2A) and add guardrails: preview count, undo window, clear feedback.
- Cross‑page selection: current selection is page‑scoped; a future enhancement can add an "All results" mode with server‑side filters.


## Concrete File Touch List (planned)
- UI
  - New: `components/bulk-actions-panel.tsx` (drag/resizable, shared)
  - Update: `components/*-bulk-action-bar.tsx` to mount the panel
  - New (2A): `components/bulk-edit-fields.tsx`
  - Update (2B): `components/dynamic-table.tsx` to support `editableColumns` and bulk confirm pill
- API
  - New: `app/api/revenue-schedules/bulk-update/route.ts`
  - Update: `lib/audit.ts` to add helpers for schedule/product bulk updates
- Docs
  - This plan; a short usage guide with screenshots after M2


## Summary of Estimates
- Idea 1 (UI overhaul)
  - Option A (Right‑Side Panel): 1.75–2.5 days
  - Option B (Top Sticky Bar): 0.6–0.9 day
  - Option C (Floating Toolbar): 0.9–1.3 days
- Idea 2 (Select‑All editing)
  - Shared groundwork: 0.4–0.6 day
  - Backend bulk endpoint (Revenue Schedules): 0.9–1.2 days
  - Variant 2A (Panel UI): 0.6–0.9 day
  - Variant 2B (In‑cell fill‑down): 1.4–2.0 days
  - Additional module per table: +0.4–0.7 day each

