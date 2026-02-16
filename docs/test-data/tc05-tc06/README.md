# TC-05 + TC-06 Test Data Pack (from `Multivendor-Test-Data-02-15` CSV)

This folder documents and seeds a minimal dataset to make these test cases executable:

- **TC-05**: Bundle (Rip & Replace)
- **TC-06**: Commission Rate Difference Handling (non-1:1 allocation path)

## Source

- Raw CSV: `docs/reference-data/Multivendor-Test-Data-02-15.xlsx - Raw Data.csv`
- Seed script: `scripts/seed-tc05-tc06-from-multivendor-csv.ts`

## Run the seed

1. Start DB connectivity (example via proxy): `docs/runbooks/Cloud_SQL_Proxy_Launch_Guide.md`
2. Ensure `DATABASE_URL` points to the target DB.
3. Run a dry-run first:
   - `npx tsx scripts/seed-tc05-tc06-from-multivendor-csv.ts --tenant-id <TENANT_UUID>`
4. Apply writes:
   - `npx tsx scripts/seed-tc05-tc06-from-multivendor-csv.ts --tenant-id <TENANT_UUID> --apply`

If your DB has only **one** tenant, you can omit `--tenant-id` (the script will auto-select it). If it has multiple, it will print the list and require you to choose.

## How to execute the tests after seeding

### TC-05 (Bundle / Rip & Replace)

Runbook reference: `docs/runbooks/2026-02-10-Reconciliation-Workflow-UAT-Browser-Steps.md`

- Open the seeded **TC-05** deposit (name starts with `UAT-RCN TC-05 Bundle`).
- In the top grid: select **line #1 + line #2**.
- In the bottom grid: select the schedule named `UAT-TC05-1812449-MIS-2026-01-01`.
- Click `Match` → confirm type `M:1` → choose `Bundle (Rip & Replace)`.
- Use replace mode as desired and complete preview/apply.

### TC-06 (Commission Rate Difference Handling)

This seed drives TC-06 through a **non-1:1 allocation** path (`1:M`) so the applied schedules end up with **different actual effective rates**.

- Open the seeded **TC-06** deposit (name starts with `UAT-RCN TC-06 RateDiff (1:M)`).
- Select the single line item in the top grid.
- In the bottom grid, select **both** schedules:
  - `UAT-TC06-1806880-VOIP-2026-01-01`
  - `UAT-TC06-1806880-MIS-2026-01-01`
- Click `Match` → confirm type `1:M` → allocate:
  - VOIP schedule: allocate usage/commission equal to the CSV VOIP row
  - MIS schedule: allocate usage/commission equal to the CSV MIS row
- Apply, then open each schedule detail page and verify:
  - `Commission Rate Actual` differs between the two schedules
  - `Commission Rate Difference` reflects (Expected - Actual) per schedule

