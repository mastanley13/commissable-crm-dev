---
title: P1-REV-001 — Change Start Date tool (Opportunity → Revenue Schedules → Manage)
owner: Engineering
status: Draft
last_updated: 2026-01-29
---

# P1-REV-001 — “Change Start Date” tool for revenue schedules

## Summary

Add a new **Change Start Date** tab to the existing **Manage Revenue Schedules** modal on the **Opportunity Details → Revenue Schedules** tab. The tool applies a month-shift to **selected revenue schedules** (selection-based), is restricted to a **single product at a time**, and requires a **mandatory reason** recorded in audit/history.

## Goals

- Enable users to shift billing schedule dates forward/backward by month for the selected schedules.
- Keep the operation safe and explainable:
  - Enforce **single-product** selection.
  - Require a **reason**.
  - Provide a **preview** before applying.
  - Write an **audit trail** for each affected schedule.

## Non-goals (v1)

- Editing cadence rules or generating new schedules (this is date-shifting only).
- Automatically resolving or re-matching deposits after shifting (future enhancement).
- Cross-product shifting (explicitly blocked).

## User entry point (UI location)

- Opportunity Details page → **Revenue Schedules** tab
- User selects one or more schedules in the table
- Clicks **Manage**
- New tab appears in the modal: **Change Start Date**

## UX / Interaction Design

### Tab layout (Change Start Date)

1. **Selection list**
   - Show the same “Select schedules” list pattern used by existing Manage tabs (Rate/Split).
   - Pre-check schedules based on the table selection when opening the modal.

2. **Inputs**
   - **New start date** (date input)
   - **Reason** (required, textarea)

3. **Computed context + preview**
   - Display:
     - Selected count
     - Detected product name (optional) + productId (for debugging)
     - Baseline date (earliest scheduleDate among selected schedules)
     - Delta months (computed)
   - Preview table:
     - Schedule label/number
     - Current schedule date
     - New schedule date

4. **Primary CTA**
   - Button: **Apply Change**
   - Disabled when validation fails; show an explicit list of blocking reasons (same pattern as deposit upload “Cannot start import” reasons).

### Validation messages (blocking reasons)

- “Select at least one revenue schedule.”
- “All selected schedules must belong to a single product.”
- “Some selected schedules are missing schedule dates and cannot be shifted.”
- “Enter a reason to continue.”
- “Enter a valid new start date.”
- (If enforced) “Selected schedules include matched/finalized schedules and cannot be shifted.”
- (If enforced) “Shifting would create duplicate schedule dates for this product.”

## Selection model and single-product rule

### Selection source

- The Opportunity Revenue Schedules table already tracks `selectedRevenueSchedules` (array of schedule ids).
- The Manage modal currently receives `initialStatusSelection`; v1 should generalize this to `initialSelectedScheduleIds` (or similar) and use it to seed the Change Start Date tab’s selectedIds (and optionally other tabs).

### Single-product enforcement

- The tool **only operates** when the selected schedules resolve to exactly **one non-null productId**.
- If multiple productIds exist, block and list each productId (and optionally product name) with counts to help the user fix the selection.

## Date shift rules (core logic)

### Baseline and shift computation

- Define `baselineDate` as the **earliest** `scheduleDate` among selected schedules.
- User provides `newStartDate`.
- Compute `deltaMonths` as the month difference between `baselineDate` and `newStartDate`:
  - `deltaMonths = (newYear - baseYear) * 12 + (newMonth - baseMonth)`
- Apply the shift to each selected schedule’s date:
  - `shiftedDate = addMonthsClamped(originalScheduleDate, deltaMonths)`

### Month-end clamping behavior

When shifting dates, preserve the day-of-month when possible; otherwise clamp to the last valid day of the target month.

Example behaviors:
- 2026-01-31 + 1 month → 2026-02-28
- 2024-01-31 + 1 month → 2024-02-29 (leap year)
- 2026-03-30 - 1 month → 2026-02-28

### Ordering and collisions

- Preserve each schedule’s relative ordering by shifting each schedule independently using the same `deltaMonths`.
- Optional (recommended) collision detection: if shifting causes two schedules in the same product to share the same `scheduleDate`, block and show the colliding dates.

## Backend design

### New API route

Add a new route:

- `POST /api/revenue-schedules/bulk/change-start-date`

Request body:

```json
{
  "scheduleIds": ["..."],
  "newStartDate": "YYYY-MM-DD",
  "reason": "string"
}
```

Response body (success):

```json
{
  "updated": 12,
  "failed": [],
  "errors": {},
  "deltaMonths": 2
}
```

Response body (partial):

```json
{
  "updated": 8,
  "failed": ["id1", "id2"],
  "errors": { "id1": "Missing scheduleDate", "id2": "Not found" },
  "deltaMonths": 2
}
```

### Permissions

- Require the same permissions used for other bulk revenue schedule operations:
  - `revenue-schedules.manage` and/or `opportunities.manage` (align with existing bulk routes)

### Server-side validation

- `scheduleIds` must be non-empty.
- `newStartDate` must parse to a valid date.
- `reason` must be non-empty (trimmed).
- All schedules must belong to the requesting tenant.
- All schedules must resolve to exactly one productId.
- All targeted schedules must have a valid `scheduleDate`.
- Optional (recommended):
  - Block schedules that are matched/finalized/in-dispute (policy decision below).
  - Collision detection against existing schedules for the product.

### Transaction strategy

- Fetch schedules (ids + current scheduleDate + productId).
- Compute per-schedule new date.
- Update schedules in a single transaction where feasible (or batched transactions if needed).
- For each updated schedule, log an audit entry (see next section).

## Audit / history requirements

Write a revenue schedule audit entry per schedule (pattern: `logRevenueScheduleAudit`).

Recommended audit payload:

- Action: `AuditAction.Update`
- Previous: `{ scheduleDate: "YYYY-MM-DD" }`
- Next:
  - `{ scheduleDate: "YYYY-MM-DD", action: "ChangeStartDate", reason: "...", deltaMonths: 2, baselineDate: "YYYY-MM-DD", newStartDate: "YYYY-MM-DD" }`

Notes:
- Reason must be easily visible in the UI history surface (wherever audits are shown today).

## Frontend implementation outline

### Files likely involved

- `components/opportunity-details-view.tsx`
  - Rename/extend the modal prop from `initialStatusSelection` to a generic selection prop used for multiple tabs (including Change Start Date).
- `components/revenue-schedule-create-modal.tsx`
  - Add new `ModalTab` id (e.g. `"startDate"`) and `TAB_DEFINITIONS` entry.
  - Add state for the tab:
    - `selectedIds: string[]`
    - `newStartDate: string`
    - `reason: string`
  - Add validation + reasons list.
  - Build preview table from `scheduleOptions` + computed shifted dates.
  - Submit handler calling the new API route; show success/error toasts consistent with existing tabs.
- (New) `app/api/revenue-schedules/bulk/change-start-date/route.ts`
  - Implement server logic + audit.

### Preview computation on the client

- Use the same month shift logic on the client for preview as on the server.
- The server remains the source of truth (recompute and validate server-side).

## Test plan

### Unit tests (recommended)

- `addMonthsClamped` behavior:
  - month-end clamping
  - negative deltas
  - leap year behavior
- `deltaMonths` calculation

### Integration/API tests (if present patterns exist)

- Rejects:
  - empty selection
  - invalid dates
  - missing reason
  - multiple products
- Updates:
  - returns updated count
  - writes audit entries

### Manual QA checklist

- From Opportunity → Revenue Schedules:
  - Select schedules for one product → Manage → Change Start Date
  - Preview looks correct (baseline earliest date; delta months; per-row new dates)
  - Apply succeeds; table reflects updated dates after refresh
  - Audit/history shows reason and old/new dates
- Try mixed product selection → blocked with clear message
- Try selection including schedules with missing dates → blocked and identifies them

## Rollout / migration notes

- No schema change is expected if audit logging can store arbitrary JSON/context today.
- If audit schema is strict, add a small migration to store the reason/context (only if needed).

## Open questions / clarifications needed

1. **Matched/finalized schedule policy:** Should users be allowed to shift schedules that are already matched to deposits, in dispute, or finalized? If not, which statuses should be blocked?
2. **Collision policy:** If shifting would create duplicate schedule dates for the product (or overlap existing schedules not in the selection), should we block, warn, or allow?
3. **Scope:** Confirm v1 is **selection-only** (no “entire series” option). If “series” is desired later, define how the series is identified (productId + cadence? scheduleNumber prefix?).
4. **Baseline date rule:** Confirm baseline is the **earliest selected scheduleDate**. Alternative is “user chooses which schedule represents the start”.
5. **Timezone/date handling:** Confirm scheduleDate is treated as a pure date (`YYYY-MM-DD`) with no timezone shifts.
6. **Audit visibility:** Where should the reason show up in the UI (schedule details view history panel, product audit panel, both)?

## Work breakdown (implementation steps)

1. Add shared date-shift helper (client + server) or duplicate with identical tests.
2. Implement API route + validations + audit logging.
3. Add modal tab + UI + preview + blocking reasons.
4. Wire Opportunity selection into the tab (seed selectedIds on open).
5. Add tests + manual QA pass on sample opportunity with multiple schedules.

