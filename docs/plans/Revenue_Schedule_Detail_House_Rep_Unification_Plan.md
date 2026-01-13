# Revenue Schedule Detail + Opportunity Detail: House Rep Unification Plan

**Project:** Commissable CRM  
**Date Created:** 2026-01-13  
**Last Updated:** 2026-01-13  

## Executive Summary

We will use a single person field, **House Rep**, everywhere we currently show **Opportunity Owner** (and any "Owner" label on the Opportunity Detail page). The underlying data source remains the existing Opportunity `owner` (`ownerId` / `owner.name`), but the UI label becomes **House Rep** for consistency across:

- Opportunity Details page
- Revenue Schedule Detail page (header + supporting details)

This is a UI/contract unification effort; it does not require a destructive schema change.

---

## Decision (Source of Truth)

**Canonical field:** `Opportunity.owner` (existing "Owner" relationship)  
**User-facing label:** `House Rep`  

Notes:
- This is a *person* field (user/rep), distinct from the existing split percent field `House Rep %`.
- Where both appear on the same page/section, ensure labels remain unambiguous (e.g., `House Rep` vs `House Rep %`).

---

## Current State

### Revenue Schedule Detail

- Header shows **Opportunity Owner** from `schedule.opportunityOwnerName`.
- Header also shows **House Rep** from `schedule.houseRepName`, but that value is often empty because it is not consistently populated by the API.
- Supporting Details -> Opportunity Details tab shows **Opportunity Owner** again (`schedule.opportunityOwnerName`).

Relevant files:
- `components/revenue-schedule-details-view.tsx`
- `components/revenue-schedule-supporting-details.tsx`
- `app/api/revenue-schedules/helpers.ts` (maps `opportunity.owner.fullName` -> `opportunityOwnerName`)

### Opportunity Detail

- Summary header shows `Owner` (the opportunity owner user).
- Create/edit/assignment flows use `ownerId` and are labeled as Owner/Opportunity Owner in some places.

Relevant file (detail page):
- `components/opportunity-details-view.tsx`

---

## Desired State

1. Revenue Schedule Detail does **not** show "Opportunity Owner" anywhere.
2. Revenue Schedule Detail shows **House Rep** populated from the Opportunity owner.
3. Opportunity Detail shows **House Rep** (instead of "Owner") for the opportunity owner user.
4. The underlying payloads remain non-breaking during rollout (keep `ownerId` in Opportunity APIs, and keep `opportunityOwnerName` temporarily in Revenue Schedule APIs until all UI usage is migrated).

---

## API / Data Contract Changes (Non-breaking)

### Revenue Schedule Detail + List DTOs

Add an alias field:
- `houseRepName`: string | null

Population rule:
- `houseRepName = opportunity.owner.fullName`

Back-compat:
- Keep `opportunityOwnerName` for now, but treat it as deprecated in UI.
- During rollout, UI should display `houseRepName ?? opportunityOwnerName ?? "--"`.

Primary implementation point:
- `app/api/revenue-schedules/helpers.ts` (`mapRevenueScheduleToListItem` and detail mapping)

Optional (future, not required for this phase):
- Add `houseRepId` if we later need linking/filtering by rep on Revenue Schedules.

---

## UI Changes

### Revenue Schedule Detail (Header)

Files:
- `components/revenue-schedule-details-view.tsx`

Changes:
- Remove the "Opportunity Owner" row from Column 1.
- Ensure the existing "House Rep" row displays the canonical value:
  - use `schedule.houseRepName` (preferred) with fallback to `schedule.opportunityOwnerName` during rollout.

### Revenue Schedule Supporting Details (Opportunity Details Tab)

Files:
- `components/revenue-schedule-supporting-details.tsx`

Changes:
- Replace "Opportunity Owner" label with "House Rep".
- Use `schedule.houseRepName` (preferred) with fallback to `schedule.opportunityOwnerName` during rollout.

### Opportunity Detail (Summary Header)

Files:
- `components/opportunity-details-view.tsx`

Changes:
- Rename the summary field label from `Owner` → `House Rep`.
- Keep the underlying field as `ownerId` in edit payloads (no API/schema rename).

Follow-up scope (optional, if we want full consistency beyond the detail page):
- Update Opportunity create modals and bulk actions that display "Opportunity Owner" to "House Rep".

---

## Acceptance Criteria

- Revenue Schedule Detail page shows **House Rep** and does not show "Opportunity Owner" anywhere.
- House Rep value matches the Opportunity's assigned owner user.
- Opportunity Detail page shows **House Rep** (for the opportunity owner user) in the Summary area.
- No breaking API changes: existing clients that still read `opportunityOwnerName` continue to work during transition.

---

## Implementation Checklist (Recommended Order)

1. **Backend:** Add `houseRepName` alias to Revenue Schedule list/detail DTOs in `app/api/revenue-schedules/helpers.ts`.
2. **Revenue Schedule UI:** Update `components/revenue-schedule-details-view.tsx` to remove "Opportunity Owner" and display House Rep consistently (with fallback).
3. **Supporting Details UI:** Update `components/revenue-schedule-supporting-details.tsx` to rename "Opportunity Owner" -> "House Rep" and display the same value.
4. **Opportunity Detail UI:** Update `components/opportunity-details-view.tsx` label `Owner` → `House Rep` (person field).
5. **Validation:** Run `npm test` (if applicable) and `npm run build`; spot-check both pages for label/value correctness.

---

## Risks / Notes

- **Terminology collision:** "House Rep" (person) vs "House Rep %" (split percent). Keep both labels explicit wherever they appear together.
- **Partial rollout:** Until the API provides `houseRepName`, the Revenue Schedule UI must use a fallback to `opportunityOwnerName`.
