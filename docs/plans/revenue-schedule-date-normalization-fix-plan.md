# Revenue Schedule Date Normalization Fix Plan

## Goal
Ensure all revenue schedule dates are treated as date-only values and always displayed/stored as the 1st of the month, without timezone drift to month-end in UI or APIs.

## Problem Summary
Users are seeing month-end dates (e.g., 2025-08-31) where the spec requires 1st-of-month dates (e.g., 2025-09-01). The specs emphasize date-only semantics and 1st-of-month enforcement, but current behavior can shift dates when UTC timestamps are formatted in local time.

## Desired Behavior (From Markdown Specs)
- Revenue schedule dates are always the 1st of the month.
  - `docs/specs/Revenue Schedule Month to Month Design.docx.md`
  - `docs/tasks/12-4-25-minimum-checklist.md`
  - `docs/02_04_work_log_ticket_plan_flat_plan.md`
- Schedule date selection should be YYYY-MM only, with day set to 1 by the system.
  - `docs/02_04_work_log_ticket_plan_flat_plan.md`
- Date-only semantics are required to prevent off-by-one errors.
  - `docs/specs/reconciliation_matching_engine_implementation_steps.md`
- Flex default schedule date should be the deposit month period (first of report month), but note spec conflicts about previous vs current month.
  - `docs/plans/flex-chargeback-handoff.md`
  - `docs/plans/UAT Guide 02_02_26.md`

## Current Behavior (Observed in Code)
- API responses for scheduleDate use `toISOString()`, which encodes UTC timestamps.
- UI uses `new Date(iso)` and formats with local `getFullYear/getMonth/getDate`, which can shift UTC midnight to the prior day in US time zones.
- Suggested schedule rows map `paymentDate` from `revenueScheduleDate`, which can be misleading and hides the true line payment date.
- Revenue schedule update APIs accept arbitrary date strings without enforcing day=1.

## Plan

1. Confirm the schedule date contract and resolve spec conflicts.
- Decide if Flex default date is current month’s 1st or previous month’s 1st.
- Confirm that all schedule dates are normalized to day=1 across all creation flows.
- Document the decision in a single source of truth and update affected specs.

2. Introduce a single date-only utility and contract.
- Add a shared helper that formats date-only strings as `YYYY-MM-DD` and parses using UTC, not local time.
- Use this helper in API responses and UI formatting for scheduleDate and other date-only fields.

3. Normalize scheduleDate at write time.
- On create/update/cloning, clamp scheduleDate to the 1st of its month (UTC).
- Enforce validation: reject or normalize non-1st dates depending on product decision.
- Update any bulk-edit or shift-date flows to preserve day=1.

4. Fix API response serialization for date-only fields.
- For `scheduleDate`, return `YYYY-MM-DD` (no time) instead of full ISO timestamps.
- Keep `paymentDate` as true payment date if it is intended to be a real date-time or real date-only, but format consistently.

5. Fix UI date rendering.
- Avoid `new Date(dateString)` with local getters for date-only fields.
- Either render the `YYYY-MM-DD` string directly or parse and format using UTC getters.
- Ensure any date filters or sorting use consistent date-only parsing.

6. Correct suggested-candidate mapping.
- Populate `paymentDate` in candidate rows from the line item’s payment date, not from `revenueScheduleDate`.
- If payment date is not available for candidates, consider leaving it blank or annotating as “Schedule Date” explicitly.

7. Data audit and remediation.
- Query schedules with day != 1 to identify legacy or drifted data.
- Decide policy for historical corrections: normalize forward only, or backfill to day=1 with audit logging.
- Provide a controlled script or admin tool to normalize a tenant’s schedules.

8. Tests and verification.
- Unit tests for date-only parsing/formatting utilities with timezone-sensitive cases.
- API tests to verify scheduleDate is returned as `YYYY-MM-DD` and remains day=1.
- UI tests for rendering schedule dates on reconciliation and schedule views.
- Regression tests for matching that depend on scheduleDate ordering and filtering.

9. Rollout plan.
- Ship backend serialization and normalization first, behind a feature flag if needed.
- Update UI formatting next to avoid date drift.
- Run data audit in staging and verify sample tenants.
- Communicate expected behavior and any data adjustments to stakeholders.

## Acceptance Criteria
- All schedule dates display as the 1st of the month in reconciliation and schedule views.
- No off-by-one date shifts in any timezone.
- Creation, clone, and edit flows only allow or produce day=1 schedule dates.
- Matching logic uses correct schedule dates and candidate payment dates.
- Data audit shows zero schedules with day != 1 for new records.

## Risks and Mitigations
- Risk: Historical schedules may change if normalized after the fact.
  - Mitigation: Apply normalization only to new records or require explicit admin approval for backfill.
- Risk: Mixed semantics between date-only and date-time fields.
  - Mitigation: Explicitly document which fields are date-only and enforce consistent serialization.

## Open Questions
- For Flex schedules, do we standardize on previous month’s 1st or current month’s 1st?
- Should non-1st legacy schedules be normalized automatically or left unchanged?
- Do we treat paymentDate as date-only or actual date-time in reconciliation views?
