# Match Wizard Validation Section Plan

Date: 2026-03-10
Owner: Engineering / Product
Scope: Replace the Match Wizard "Preview" step with an auto-running "Validation" step in the reconciliation modal.

## Objective

Update the Match Wizard so the current Preview section becomes a Validation section that:

- runs automatically when the selection or allocations become previewable
- clearly tells the user whether validation found issues or found no issues
- keeps Apply blocked only for blocking validation errors
- removes the current mixed messaging between "Preview", "Run Preview", and "Run Validation Again"

## Current State

The modal already has most of the backend behavior needed:

- `components/reconciliation-match-wizard-modal.tsx`
  - stores validation results in `preview`
  - calls `runPreview()` against `/api/reconciliation/deposits/[depositId]/matches/preview`
  - auto-runs only for `ManyToOne`
  - still labels the UI as "Preview"
- `app/api/reconciliation/deposits/[depositId]/matches/preview/route.ts`
  - already returns the validation payload needed by the modal
- `lib/matching/match-group-preview.ts`
  - already computes blocking errors, warnings, and after-apply summaries

Current UX issues in the modal:

- top pill says `Preview`
- section header says `Preview`
- footer still has `Preview` and `Run Preview`
- `ManyToOne` auto-runs validation, but other match types still feel manual
- the user does not get a strong "no issues" state
- the same validation problem can be repeated in multiple places

## Recommended Product Behavior

### 1. Rename the step from Preview to Validation

User-facing labels should change from `Preview` to `Validation` throughout the modal:

- step pill
- section title
- footer jump button
- blocked/apply helper copy

Recommendation: keep the route and internal type names as `preview` for the first pass to avoid unnecessary backend churn. This is a UX rename first, not a protocol rewrite.

### 2. Auto-run validation for all supported match types

Validation should auto-run whenever all of these are true:

- the modal is open
- the selection is compatible with the chosen match type
- allocation rows exist
- the flow is not blocked by bundle replacement prerequisites

Trigger validation when:

- selected lines change
- selected schedules change
- match type override changes
- allocation values change
- bundle replacement creates replacement schedules and returns the wizard to allocation mode

Recommendation: debounce auto-validation by about `250-400ms` after allocation edits so number inputs do not fire a request on every keystroke.

### 3. Make validation state explicit

Replace the current implicit preview model with a simple UI state model:

- `idle`: waiting for enough information to validate
- `running`: validation in progress
- `valid`: no blocking issues found
- `warning`: warnings exist, but apply is still allowed
- `error`: blocking issues found
- `stale`: allocations changed since the last completed validation
- `system_error`: request failed or response was invalid

Implementation note:

- this can still be backed by the existing `preview`, `previewLoading`, `previewVersion`, and `previewError` state in phase 1
- a follow-up cleanup can rename these internals to `validation*` once the UX ships cleanly

### 4. Replace the current Preview area with a Validation summary card

The new Validation section should prioritize status over after-apply detail.

Recommended layout:

1. Header
   - `Validation`
   - helper text: `Validation runs automatically when allocations change.`

2. Status banner
   - success: `No validation issues found. Ready to apply.`
   - warning: `Validation found warnings. Review before applying.`
   - error: `Validation found blocking issues. Fix them before applying.`
   - running: `Running validation...`
   - idle: `Validation will start once selection and allocations are ready.`
   - system error: `Validation could not be completed. Try again.`

3. Details list
   - render warnings and errors once, in one structured list
   - do not also repeat the same first issue as standalone red text

4. Optional action
   - keep a small secondary `Run validation again` control for manual retry after network/system errors
   - do not present it as the primary path

### 5. Show a positive "no issues" state

This is the main behavior gap in the current modal.

When validation completes with:

- `preview.ok === true`
- no issue with `level === "error"`
- validation result is current

show an explicit green state such as:

`No validation issues found. You can apply this match.`

If warnings exist but no blocking errors:

- show amber styling
- keep Apply enabled
- state clearly that warnings are allowed

### 6. Simplify Apply messaging

Apply should reference validation, not preview:

- `Run validation first` becomes `Waiting for validation`
- `Preview is out of date. Run preview again.` becomes `Validation is updating after your latest changes.`
- `Fix preview errors before applying.` becomes `Fix validation errors before applying.`

If validation is auto-running, the Apply panel should not ask the user to manually trigger it unless the request actually failed.

## UI Copy Proposal

### Validation section

- Title: `Validation`
- Helper: `Validation runs automatically when allocations change.`

### Status messages

- Idle: `Validation will start when this match is ready.`
- Running: `Running validation...`
- Success: `No validation issues found. Ready to apply.`
- Warning: `Validation found warnings. Apply is still allowed.`
- Error: `Validation found blocking issues. Fix them before applying.`
- System error: `Validation could not be completed. Try again.`

### Apply panel

- Waiting: `Apply is blocked`
- Waiting detail: `Validation has not completed yet.`
- Stale detail: `Validation is updating after your latest changes.`
- Error detail: `Fix validation issues before applying.`

## Technical Plan

### Phase 1. UX rename and auto-validation behavior

Files expected to change in implementation:

- `components/reconciliation-match-wizard-modal.tsx`

Tasks:

- rename user-facing `Preview` labels to `Validation`
- rename `previewSectionId` usage to `validationSectionId` in the component
- change the helper text under the step pills
- remove the inline "Run Preview" primary flow from the footer
- keep only a retry button in the Validation section when needed
- extend the auto-run effect so it applies to all supported match types, not just `ManyToOne`
- debounce requests from allocation edits

### Phase 2. Validation presentation cleanup

Files expected to change in implementation:

- `components/reconciliation-match-wizard-modal.tsx`

Tasks:

- replace free-floating `previewError` rendering with a dedicated system-error banner
- deduplicate issue rendering so each validation problem appears once
- add the explicit green "no issues" card
- add stale/updating state copy while a new validation pass is pending

### Phase 3. Payload and naming cleanup

Files that may change if we want naming consistency after the UX ships:

- `app/api/reconciliation/deposits/[depositId]/matches/preview/route.ts`
- `lib/matching/match-group-preview.ts`
- `components/reconciliation-match-wizard-modal.tsx`

Tasks:

- decide whether to keep `preview` naming internally or rename to `validation`
- if renamed, update types and helper names without changing behavior
- keep the existing route path unless there is a strong product reason to version the API

Recommendation: defer this phase unless naming confusion slows future work.

## Recommended Handling of Existing "After Apply" Summaries

The current Preview section shows:

- lines after apply
- schedules after apply

That content is secondary to the new validation requirement.

Recommendation:

- remove these summaries from the primary Validation section for the first UX pass
- if Product still wants outcome visibility, move them into a collapsed `Impact details` section below validation status
- do not let these details compete with the core message of `issues found` vs `no issues found`

## Acceptance Criteria

1. The modal no longer presents Preview as a step or primary action.
2. Validation runs automatically when a match becomes validatable and re-runs after allocation edits.
3. The user sees one clear status:
   - no issues
   - warnings
   - blocking issues
   - validation running
   - validation failed
4. Apply becomes enabled only when the latest validation result is current and has no blocking errors.
5. The modal does not require the user to click `Run Preview` as part of the normal happy path.
6. Validation issues are not duplicated in multiple visible regions.
7. Bundle-replacement and other blocking Many:1 errors still surface correctly within the new Validation section.

## Test Plan

### Component / interaction tests

- opens modal and shows `Validation` instead of `Preview`
- auto-runs validation on initial ready state
- re-runs validation after allocation edits
- shows success banner when validation returns no issues
- shows warning banner when only warnings are returned
- shows error banner and blocks Apply when validation returns blocking issues
- shows system-error banner and retry action on failed request
- keeps Apply disabled while validation is in progress or stale

### Regression scenarios

- `OneToOne` fast-path selection still validates correctly
- `OneToMany` allocation edits trigger auto-validation
- `ManyToOne` mixed-rate replacement flow still auto-detects and blocks direct apply
- bundle replacement returns the wizard to a validatable state and validation re-runs automatically

### Manual QA

- verify the footer no longer asks the user to Preview
- verify the top pill color/status logic still works after the label rename
- verify no duplicate issue text remains on blocking validation cases
- verify success state is obvious without scrolling into Apply

## Risks and Decisions

### Risk: Too many validation requests while typing

Mitigation:

- debounce auto-validation
- ignore duplicate request keys

### Risk: Removing preview details may hide useful context

Mitigation:

- keep an optional collapsed `Impact details` area if users still need before/after information

### Risk: Mixed internal naming (`preview` vs `validation`)

Mitigation:

- accept mixed internals in phase 1 to keep the implementation small
- schedule a cleanup pass only if needed

## Recommendation

Ship this as a focused modal UX change:

- rename Preview to Validation
- auto-run validation for all supported match types
- surface one explicit status card with `issues found` or `no issues found`
- keep apply gating tied to the latest validation result
- remove Preview as a required user action in the normal flow
