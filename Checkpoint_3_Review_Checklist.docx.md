**Checkpoint 3 Review Checklist**

*Revenue Schedules + Reconciliation (Browser Walkthrough + Engineering Validation)*

Last updated: January 13, 2026

## Progress snapshot (as of 2026-01-13)

- Engineering Validation items updated based on repo/code review.
- Browser Walkthrough items still require manual QA with real sample files.

# **How to use this checklist**

Run the Browser Walkthrough first (as a user), then use the Engineering Validation section to confirm backend/data correctness. Mark each item Pass/Fail and capture a screenshot or note for any failures.

# **Pre-flight setup**

- [ ] Log in with an Admin user (to configure thresholds/settings) and an Accounting user (to run reconciliation).
- [ ] Have at least one real distributor/vendor deposit file ready for upload.
- [ ] Create Opportunities + Revenue Schedules that should match rows in the deposit file (use realistic product names / service types).
- [ ] Confirm you can access: Products, Opportunities, Revenue Schedules, Reconciliation.

# **Browser Walkthrough**

## **1) Product & Opportunity prerequisites**

- [ ] Create or edit a Product using House Product Family/Subtype fields (vendor/distributor fields should not block creation).
- [ ] Create an Opportunity using the Product and set it up so Revenue Schedules can be generated.
- [ ] If your UI includes lookup fields (Subagent, Parent Account), confirm typeahead + dropdown works and selection persists.

## **2) Revenue Schedule generation (dual-mode)**

- [ ] Auto-create: verify schedules are created automatically from the Opportunity workflow (e.g., on Close) and have correct periods.
- [ ] Manual/API create: create a schedule via the UI or import/API path and confirm it produces the same structure as auto-create.
- [ ] Verify schedule dates align to the 1st of the month, and the count of periods is correct.
- [ ] Verify commission split totals equal 100% and calculations are correct to the penny.

## **3) Deposit file mapping (two-panel mapping UI)**

- [ ] Navigate to Reconciliation -> Upload Deposit (or equivalent). Start the upload wizard. (Code: `/reconciliation/deposit-upload-list`)
- [ ] Confirm mapping UI shows: (A) known/pre-mapped fields for this distributor/vendor and (B) non-blank extra fields that are not mapped.
- [ ] Confirm you cannot create redundant custom fields (e.g., multiple Address 1). (Code review note: duplicate custom labels are currently possible.)
- [ ] Confirm default/unused fields 1-4 are removed and blank source fields do not appear.
- [ ] Confirm Cancel / Undo exists in the wizard, and returns you safely without leaving partial import artifacts. (Code review note: no import happens until Confirm.)

## **4) Deposit upload**

- [ ] Complete the upload. Confirm the deposit appears in the Reconciliation list with the correct totals and metadata.
- [ ] Try to reverse/cancel the upload (if supported). Confirm the system rolls back cleanly.

## **5) Matching workflow (V1 AI reconciliation)**

- [ ] Default view is Unmatched deposits/lines.
- [ ] Select a deposit line (top grid). Confirm the system shows suggested Revenue Schedule matches in the bottom grid.
- [ ] Verify suggested matches are filtered by a confidence threshold and that you can lower threshold via a confidence slider (including 0 = no limit). (Code: `components/deposit-reconciliation-detail-view.tsx` + `app/api/reconciliation/user-settings/route.ts`)
- [ ] Verify there is a clear Match button (left of Search or otherwise obvious).
- [ ] Match 1:1 - select one schedule and match. Confirm the schedule shows Actual Usage + Actual Commission values updated from the deposit line.
- [ ] Match split - match one deposit line to multiple schedules. Confirm allocations sum correctly.
- [ ] Match merge - match multiple deposit lines to one schedule. Confirm allocations sum correctly.

## **6) Variance handling & adjustments**

- [ ] Create a scenario where deposit amount != expected amount. On match, confirm the system prompts for: (1) one-time adjustment, (2) FLEX product, or (3) manual entry.
- [ ] Adjustment path: create a one-time adjustment and confirm it is visible/auditable and updates balances.
- [ ] FLEX product path: create a temporary product for the difference and confirm it is linked to the schedule and reconciles correctly.
- [ ] Manual path: enter a manual adjustment; confirm totals and balances update.

## **7) Finalize reconciliation + payment tracking**

- [ ] Finalize/Commit: confirm a batch finalize (or reconcile action) updates schedules and deposits atomically.
- [ ] Verify payment/balance tracking reflects matched and finalized amounts.
- [ ] Open a Revenue Schedule detail page and confirm you can see reconciled deposits and payments made (if these tabs exist in your build).

## **8) Edge cases**

- [ ] Chargeback scenario: confirm chargebacks can be ingested, matched, and processed according to your rules.
- [ ] Commission-only deposit lines (no usage): confirm they can be matched and reconcile correctly (if supported).
- [ ] Idempotency: re-upload the same file (or retry the same upload) and confirm it does not create duplicate deposits/schedules.

## **9) UI consistency items bundled with Checkpoint 3**

- [ ] Delete modals are standardized across Accounts/Contacts/Opportunities/Revenue Schedules/Products.
- [ ] Table header alignment is consistent; blue header line aligns across tabs.
- [ ] Revenue periods are stored/edited as integers (if visible in UI).

# **Engineering Validation (for coding agent)**

## **A) Data integrity**

- [x] Reconciliation matches support split + merge allocations (many-to-many) and store matched amounts per link. (Code: `prisma/schema.prisma` `DepositLineMatch.usageAmount`/`commissionAmount`)
- [x] Totals check: Sum(matched amounts) drives deposit line allocated/unallocated values. (Code: `lib/matching/deposit-line-allocations.ts`)
- [x] Finalize uses a DB transaction so deposits + schedules update atomically. (Code: `app/api/reconciliation/deposits/[depositId]/finalize/route.ts`)

## **B) Config + AI matching**

- [x] Confidence threshold is configurable and applied to suggested matches. (Code: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts`)
- [x] Confidence slider can override threshold down to 0 (no limit). (Code: UI slider min 0; API validates `0..1` in `app/api/reconciliation/user-settings/route.ts`)

## **C) Performance & security**

- [ ] Upload + parse performance is acceptable on large files (e.g., thousands of rows).
- [ ] Match operation performs within acceptable time for ~1,000 records.
- [ ] RBAC: Salesperson cannot access reconciliation/payment data; Accounting/Admin can. (Code review note: reconciliation routes enforce permissions like `reconciliation.view`/`reconciliation.manage`, but role-to-permission mapping still needs QA.)

# **Sign-off**

Reviewer: ____________________________    Date: ____________________________

Environment: __________________________  Build/Commit: ______________________

Notes / defects found:

____________________________________________________________________________

____________________________________________________________________________
