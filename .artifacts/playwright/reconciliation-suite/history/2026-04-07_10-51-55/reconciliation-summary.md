# Reconciliation Scenario Export

Run ID: 2026-04-07_10-51-55
Generated: 2026-04-07T14:54:44.346Z

## Totals

- Total scenarios: 105
- Pass: 2
- Pass-pending-ui-review: 1
- Fail: 1
- Blocked: 101
- Not recorded: 0
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

- RS-001 Exact Match All Key Fields: pass
- RS-002 Exact match using Additional Information metadata: pass
- RS-003 Single deposit line splits cleanly across multiple schedules: pass-pending-ui-review

## Runtime Path Validations

- None in this run.

## Failures

- RS-004 Multiple deposit lines roll up to one schedule: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('dialog', { name: 'Reconciliation match wizard' }).getByText('Applied successfully')
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 20000ms[22m
[2m  - waiting for getByRole('dialog', { name: 'Reconciliation match wizard' }).getByText('Applied successfully')[22m


## Top Blocked Reasons

- 81 scenario(s): Deposit detail endpoint returned HTTP 500 for the mapped runtime fixture.
- 20 scenario(s): The mapped reconciliation deposit route rendered the app 404 page in the current browser session, so the scenario could not be executed.
