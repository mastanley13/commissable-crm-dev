# Reconciliation Scenario Export

Run ID: 2026-04-07_10-51-08
Generated: 2026-04-07T14:51:44.929Z

## Totals

- Total scenarios: 105
- Pass: 0
- Pass-pending-ui-review: 0
- Fail: 0
- Blocked: 1
- Not recorded: 104
- Runtime-path validations: 0

## Lanes

- @deterministic: 71
- @ui-review: 28
- @needs-clarification: 6
- @known-bug: 0

## Interpretation

- `pass`: automated assertions completed successfully.
- `pass-pending-ui-review`: the deterministic/browser evidence was good enough to proceed, but a human operator still needs to review the decision point or final allocation.
- `blocked`: the scenario was intentionally not claimed because the current test DB does not contain a valid prepared fixture, or the source-of-truth workflow is still unclear.
- `fail`: Playwright attempted the mapped live scenario and the browser assertion or interaction failed.
- `not-recorded`: the manifest listed the scenario, but this run did not write a scenario result file.
- `runtime-path-validation`: a harness-correction or workflow-path check that must not be read as final row proof.

## Ready For Review

- None in this run.

## Runtime Path Validations

- None in this run.

## Failures

- None in this run.

## Top Blocked Reasons

- 1 scenario(s): The mapped deposit line item exists in the detail payload but did not render as a selectable row in the current browser session.
