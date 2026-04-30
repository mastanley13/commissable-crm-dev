# Reconciliation Scenario Export

Run ID: 2026-04-22_full-reconciliation-recorded_14-27-40
Generated: 2026-04-22T18:53:43.848Z

## Totals

- Total scenarios: 105
- Pass: 56
- Pass-pending-ui-review: 49
- Fail: 0
- Blocked: 0
- Not recorded: 0
- Runtime-path validations: 5

## Lanes

- @deterministic: 72
- @ui-review: 28
- @needs-clarification: 5
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
- RS-004 Multiple deposit lines roll up to one schedule: pass
- RS-006 Only part of deposit intentionally applies to available schedules: pass
- RS-007 Paid commission ties mathematically even if stated % field is informational: pass
- RS-008 Line item requires penny placement but totals still exact: pass
- RS-009 Usage higher than expected: pass
- RS-010 Usage lower than expected: pass
- RS-011 Usage slightly off but inside admin threshold: pass
- RS-012 Usage off beyond allowed threshold: pass
- RS-013 Deposit reports zero usage where schedule expects usage: pass
- RS-014 Deposit shows usage before expected schedule amount: pass
- RS-021 Current month usage high due to prior-period true-up: pass
- RS-022 Actual usage differs by pennies from expected rounding: pass
- RS-023 Commission paid higher than expected while usage is exact: pass
- RS-024 Commission paid lower than expected while usage is exact: pass
- RS-025 Commission amount matches even though usage does not: pass
- RS-026 Carrier billed usage but paid no commission: pass
- RS-028 Carrier claws back previously paid commission: pass
- RS-032 Special payout creates extra commission dollars: pass
- RS-033 Current commission includes prior recovery amount: pass
- RS-034 Actual rate lower than expected: pass
- RS-035 Actual rate higher than expected: pass
- RS-036 Classic lower-rate mismatch: pass
- RS-037 Classic higher-rate mismatch: pass
- RS-038 Derived rate disagrees with stored expected rate but paid dollars are internally consistent: pass
- RS-039 Carrier-provided rate field does not equal actual commission/usage math: pass
- RS-040 Actual rate changes and should apply forward: pass
- RS-041 Actual rate differs for a single schedule only: pass
- RS-044 Carrier pays no commission rate on active bill: pass
- RS-045 Derived actual rate materially above expected norms: pass
- RS-046 Usage lower and rate different: pass
- RS-047 Usage higher and rate different: pass
- RS-048 Usage exact but paid commission not supported by expected or derived rate: pass
- RS-049 Paid commission ties to deposit math, but not to schedule expectation: pass
- RS-050 Usage, rate, and commission all inconsistent: pass
- RS-053 Part of deposit reconciles exactly and remainder carries variance: pass
- RS-054 Opposing signals create abnormal effective rate: pass
- RS-055 Higher bill with lower paid commission: pass
- RS-073 No schedules satisfy metadata and amount expectations: pass
- RS-078 Carrier pays prior month in current file: pass
- RS-079 Carrier prepays earlier than expected: pass
- RS-080 Standard line includes unexpected extra commission: pass
- RS-082 Metadata aged but IDs and amounts fit: pass
- RS-083 Customer name text wrong but unique IDs right: pass
- RS-084 Carrier pays a line that should no longer be active: pass
- RS-085 Deposit line contains only vendor/distributor and dollars: pass
- RS-086 Actual rate includes extra decimal precision before rounding: pass
- RS-087 Actual commission not tied proportionally to usage: pass
- RS-088 Commission off by $0.01 high: pass
- RS-089 Commission off by $0.01 low: pass
- RS-092 Actual derived rate rounds to expected after 2 decimals: pass
- RS-093 Actual derived rate rounds below expected at 2 decimals: pass
- RS-095 Both usage and commission differ slightly from rounding: pass
- RS-096 Small usage rounding cannot explain large commission gap: pass
- RS-097 Rounded display shows 0 but underlying source created cents: pass
- RS-003 Single deposit line splits cleanly across multiple schedules: pass-pending-ui-review
- RS-005 Bundle payment matches multiple bundled products: pass-pending-ui-review
- RS-015 Negative usage/credit hits existing schedule: pass-pending-ui-review
- RS-016 Total usage matches but one schedule receives too much: pass-pending-ui-review
- RS-017 Total usage matches but one schedule receives too little: pass-pending-ui-review
- RS-018 Deposit cannot split evenly across schedules: pass-pending-ui-review
- RS-020 Multiple deposits sum below expected schedule usage: pass-pending-ui-review
- RS-027 Commission paid despite zero reported usage: pass-pending-ui-review
- RS-029 Total commission correct but schedule split wrong: pass-pending-ui-review
- RS-030 Multiple deposit lines sum to too much commission: pass-pending-ui-review
- RS-031 Multiple deposit lines sum to too little commission: pass-pending-ui-review
- RS-042 One deposit line spans schedules with different expected rates: pass-pending-ui-review
- RS-043 Multiple deposit lines create weighted actual rate different from expected: pass-pending-ui-review
- RS-051 Usage and commission both misallocated across multiple schedules: pass-pending-ui-review
- RS-056 Distributor and vendor match but secondary metadata sparse: pass-pending-ui-review
- RS-057 Primary fields match but one secondary ID differs: pass-pending-ui-review
- RS-058 Standard fields weak, Additional Information field confirms schedule: pass-pending-ui-review
- RS-059 Names differ but stronger IDs align: pass-pending-ui-review
- RS-060 Friendly account name differs while IDs align: pass-pending-ui-review
- RS-061 Product naming differs between carrier and schedule: pass-pending-ui-review
- RS-062 Service ID absent on deposit but other metadata supports match: pass-pending-ui-review
- RS-063 Location missing but customer/order data aligns: pass-pending-ui-review
- RS-064 Other order ID absent but service and account align: pass-pending-ui-review
- RS-065 Customer ID absent from schedule/deposit pair: pass-pending-ui-review
- RS-066 Custom metadata mostly aligns with one conflicting value: pass-pending-ui-review
- RS-067 Only primary fields plus dollar pattern make sense: pass-pending-ui-review
- RS-068 Deposit could map to more than one valid schedule set: pass-pending-ui-review
- RS-069 Two schedules look almost identical for same deposit line: pass-pending-ui-review
- RS-070 Part of deposit cannot be assigned after best match: pass-pending-ui-review
- RS-071 Applying deposit across schedules would exceed received totals: pass-pending-ui-review
- RS-074 Bundle deposit appears but only some products exist as schedules: pass-pending-ui-review
- RS-076 Names align but deal-specific IDs point elsewhere: pass-pending-ui-review
- RS-077 One line may apply to several product types under same account: pass-pending-ui-review
- RS-081 Current line reduced by prior-period chargeback: pass-pending-ui-review
- RS-090 Split leaves one-cent remainder: pass-pending-ui-review
- RS-094 One split line looks off but total is exact: pass-pending-ui-review
- RS-098 User accepts actual rate for current schedule only: pass-pending-ui-review
- RS-099 User accepts actual rate for this and future schedules: pass-pending-ui-review
- RS-100 User accepts actual rate and updates master catalog: pass-pending-ui-review
- RS-101 User agrees actual usage is valid one-off variance: pass-pending-ui-review
- RS-102 User manually distributes deposit across schedules: pass-pending-ui-review
- RS-103 User accepts matched portion and leaves remainder open: pass-pending-ui-review
- RS-104 User decides candidate is wrong despite strong metadata: pass-pending-ui-review
- RS-105 User confirms spiff/flat/minimum payout is valid: pass-pending-ui-review

## Runtime Path Validations

- RS-019 Multiple deposits sum above expected schedule usage: pass-pending-ui-review (runtime-path-validation)
- RS-052 Some deposit lines align, others conflict against one schedule: pass-pending-ui-review (runtime-path-validation)
- RS-072 Not all deposit lines needed but some still selected: pass-pending-ui-review (runtime-path-validation)
- RS-075 Multiple lines appear to belong to one opp but different products: pass-pending-ui-review (runtime-path-validation)
- RS-091 Aggregated lines create cent residual: pass-pending-ui-review (runtime-path-validation)

## Failures

- None in this run.

## Top Blocked Reasons

- None in this run.
