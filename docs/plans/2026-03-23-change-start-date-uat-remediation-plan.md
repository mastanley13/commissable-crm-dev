---
title: Change Start Date UAT Remediation Plan
owner: Engineering
status: Draft
last_updated: 2026-03-23
source_feedback:
  - docs/notes/Changing Rev Sch Start Dates Error.docx.md
  - docs/analysis/2026-03-12-march-2026-spec-comparative-analysis.md
---

# Change Start Date UAT Remediation Plan

## Goal

Close the March 2026 UAT gaps in the Change Start Date modal so users can preview date shifts, understand collisions before submit, and safely apply changes without ambiguous errors.

## Approved implementation contract

- The March 2026 client memo and this remediation plan are the source of truth for this pass.
- One Change Start Date action operates on selected rows from exactly one `opportunityProductId` chain.
- Mixed selections across multiple `opportunityProductId` values are blocked before preview.
- Collision scope is the same `opportunityProductId` only.
- The action hard-blocks if any selected row is missing `opportunityProductId`. There is no fallback to `productId` or `productId + accountId` logic in this pass.
- Apply is all-or-nothing in one transaction. No partial success.
- Baseline date is the earliest selected schedule date. New Start Date moves that earliest row to the chosen date and shifts every other selected row by the same delta months.
- Reason is required for apply and is not required for preview.
- Matched, finalized, and disputed schedules are blocked from this tool in this pass.
- Schedule dates are treated as month-start, date-only values. Missing or non-normalized dates are blocked, not silently corrected.
- Server-side validation is authoritative. Preview and apply must use the same shared rules engine.
- This pass ignores the older "single-product" wording. The scope rule is one `opportunityProductId` chain only.

## Current-state summary

- The feature exists, but the UAT complaints are valid.
- `components/revenue-schedule-create-modal.tsx` computes a local shift preview, but it does not run live collision checks and does not disable Apply when a collision would fail on submit.
- `app/api/revenue-schedules/bulk/change-start-date/route.ts` only checks collisions on submit and returns raw schedule ids in the error text.
- The current route resolves collision scope by product and account, which is broader than the approved same-`opportunityProductId` rule for this pass.
- `tests/integration-revenue-schedule-change-start-date.test.ts` only covers a happy path and does not protect the collision workflow.

## Gap-to-root-cause map

| Client issue | Current gap | Root cause | Planned fix |
| --- | --- | --- | --- |
| Current date is hard to find | The generic selection table puts `Schedule Date` at the far right | The tab reused a generic selection grid instead of a start-date-specific review grid | Replace the start-date table with a purpose-built preview grid that keeps current and new dates next to the schedule number |
| New date is disconnected from the selected rows | Proposed dates only appear in a separate preview section | Preview logic was added as a secondary summary, not integrated into the row model | Render `Current Schedule Date`, `New Schedule Date`, and `Status` in the same table |
| Collision message is not actionable | User sees one block of text with raw ids after submit | The API returns a string error instead of structured row-level conflict data | Add a preview endpoint and structured conflict payload with schedule numbers and dates |
| Apply stays enabled during invalid states | The UI has blocking reasons for missing fields, but not for server collisions | Collision logic only exists in the submit route | Run live preview validation and disable Apply whenever preview reports any collision |
| Layout feels uneven and hard to scan | Inputs and preview are stacked inconsistently | The tab was added to the modal without a dedicated UX pass | Move to a two-column layout with inputs on the left and shift summary on the right |

## Remediation workstreams

### 1. Implement the approved business rules

Exit criteria:

- The backend and UI enforce the approved rules in the implementation contract above.

### 2. Move preview and collision logic into a shared backend service

- Extract the date-shift and collision evaluation into a shared library, for example `lib/revenue-schedule-change-start-date.ts`.
- Use the shared logic from both:
  - `POST /api/revenue-schedules/bulk/change-start-date/preview`
  - `POST /api/revenue-schedules/bulk/change-start-date`
- Return structured preview data:
  - selected count
  - `opportunityProductId`
  - baseline date
  - new start date
  - delta months
  - per-row current date
  - per-row proposed new date
  - per-row status: `ready` or `collision`
  - plain-English conflict summary
  - `canApply`
- Block preview and apply when:
  - selected rows span multiple `opportunityProductId` values
  - any selected row is missing `opportunityProductId`
  - any selected row is matched, finalized, or disputed
  - any selected row has a missing or non-normalized schedule date
- Replace raw ids in user-facing errors with schedule numbers and dates.
- Keep the apply route authoritative and reject any stale or invalid submission even if the UI already previewed it.

Exit criteria:

- Preview and apply use the same collision rules.
- No user-facing error contains UUIDs.
- The route can explain which rows conflict and why.

### 3. Rebuild the Change Start Date tab around the preview model

- Stop relying on the generic `SelectedSchedulesTable` for this tab.
- Build a start-date-specific table in `components/revenue-schedule-create-modal.tsx` with these columns:
  - Revenue Schedule #
  - Current Schedule Date
  - New Schedule Date
  - Status
  - Product
  - Distributor
  - Vendor
  - Opportunity
- Highlight `New Schedule Date` in amber when valid and red when colliding.
- Show a `Ready` or `Collision` badge per row.
- Trigger preview refresh whenever the user changes:
  - selected schedules
  - new start date
  - reason is not required for preview, only for apply
- Disable Apply when:
  - preview is loading
  - preview reports any collision
  - required form fields are missing
- Replace the current error block with a concise conflict box that lists plain-English collisions.
- Keep the shift summary on the right side of the form:
  - selected count
  - baseline date
  - new start date
  - delta months
  - explicit note that the earliest selected row is the anchor
  - note that all selected rows shift by the same delta
- Use implementation copy that refers to one opportunity product chain and avoid the older "single-product" wording in this pass.

Exit criteria:

- Users can identify every collision directly in the table before submit.
- Apply cannot be clicked while the preview is invalid.
- The tab layout matches the client's scan path.

### 4. Harden validation and regression coverage

- Expand `tests/integration-revenue-schedule-change-start-date.test.ts` to cover:
  - happy-path shift
  - internal collision inside the selected set
  - external collision on the same `opportunityProductId`
  - non-collision when another opportunity product has the same product/date but should not block
  - mixed selection across `opportunityProductId` values is blocked
  - missing `opportunityProductId` is blocked
  - response text never exposing raw ids
  - known regression where changing to February 1 incorrectly produced a June 1 result
- Add focused unit tests for the shared preview logic:
  - delta-month calculation
  - month-end clamping
  - collision bucketing
  - row status generation
- If the frontend test stack supports it, add a component test for:
  - row status rendering
  - Apply disabled during collision
  - preview refresh on new date change

Exit criteria:

- Collision behavior is covered in automated tests, not only manual UAT.
- The known start-date regression path has a repeatable test.

### 5. UAT readiness and rollout

- Update the runbook or release notes with the new workflow and screenshots.
- Seed at least two UAT-ready examples:
  - one valid shift
  - one collision scenario
- Run:
  - `npm run build`
  - `npm test`
  - DB-backed integration tests with `RUN_INTEGRATION_TESTS=1`
- Validate the exact client feedback path with the same date examples used in the memo.

Exit criteria:

- The team can demo both a clean path and a blocked collision path before the next UAT round.

## Suggested implementation order

1. Encode the approved scope, eligibility, and atomicity rules in the shared backend service.
2. Extract shared preview/apply logic into a library.
3. Add the preview API route.
4. Update the apply route to use the shared logic and structured error payloads.
5. Replace the start-date tab UI with a dedicated preview grid and live validation.
6. Add regression tests.
7. Run build, test, and DB-backed verification.

## Expected file touchpoints

- `components/revenue-schedule-create-modal.tsx`
- `app/api/revenue-schedules/bulk/change-start-date/route.ts`
- `app/api/revenue-schedules/bulk/change-start-date/preview/route.ts`
- `lib/revenue-schedule-date-shift.ts`
- `lib/revenue-schedule-change-start-date.ts`
- `tests/integration-revenue-schedule-change-start-date.test.ts`

## Acceptance criteria

- The schedule table shows `Current Schedule Date` immediately next to the revenue schedule number.
- The same table shows `New Schedule Date` and `Status` for every selected row.
- Mixed selections across `opportunityProductId` values are blocked before preview.
- Rows missing `opportunityProductId` are blocked with a clear error.
- Collision detection runs before submit and updates as the user changes the start date.
- Any colliding row is visually marked in red and labeled `Collision`.
- The conflict summary uses dates and schedule numbers, not database ids.
- Apply is disabled whenever any collision exists.
- Matched, finalized, and disputed schedules are blocked from this tool in this pass.
- The shift summary remains visible without forcing the user to scroll to understand the delta.
- The backend still rejects invalid submissions even if the UI state gets stale.
- Automated coverage includes the known February 1 regression path.

## Remaining business signoff before merge

- Selected rows only is the approved scope for this pass. If the business later wants "auto-include all future schedules," that should be a separate change request.
- Matched, finalized, and disputed schedules are blocked by default in this pass. If the business later wants them shiftable, that should be a deliberate follow-on rule with reconciliation impact review.
- Hard-block on missing `opportunityProductId` is the approved safe default. Any fallback behavior would require explicit signoff.
- DB-backed integration coverage is disabled by default in this repo, so test environment setup must be part of the delivery checklist.
