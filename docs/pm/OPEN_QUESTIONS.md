# Open Questions

## 2026-03-12

### Task 9: Cross-deal reconciliation guard scope

- The action plan marks the final Task 9 guard as assumed and asks whether the enforced rule should be deal/opportunity-only, or deal plus distributor/vendor validation.
- The current repo has a reliable shared customer-account context on `RevenueSchedule.accountId` and a sometimes-resolved customer account on `DepositLineItem.accountId` / exact `accountNameRaw`, but deposit lines do not carry a first-class `opportunityId`.
- This batch implements the conservative account-context guard needed to block known-bad mismatches like `DW Realty` vs `Edge Business` across preview/apply flows.
- Product still needs to confirm whether manual reconciliation must also hard-fail on distributor/vendor mismatches after customer/deal context passes, or whether account/deal context alone is the intended final rule.
