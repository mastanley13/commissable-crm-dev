# Cloud SQL Overview And Cleanup Plan

Date: 2026-03-12

## Purpose

This document captures the full Cloud SQL context discussed on 2026-03-12 so the current state, risks, and recommended cleanup path are easy to revisit later.

## Guardrails

- All investigation was read-only.
- No database data was modified.
- No Cloud SQL settings were changed.
- No instances were stopped, deleted, cloned, or restored as part of this work.

## Short answer

- `commissable-sql` should remain the live production instance.
- `commissable-sql-clone-2` is the best candidate to keep temporarily as a testing instance.
- `commissable-sql-clone` and `commissable-sql-pitr-20260311-200030` look like the best cleanup candidates once you confirm nobody still needs them.
- Do not overwrite `commissable-sql` from either March 11 instance. Production is currently ahead of both.

## Current instance inventory

All 4 instances are in `us-central1` and are currently billable always-on Cloud SQL Postgres instances.

| Instance | Created | State | Tier | Disk | PITR | Insights | Public IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `commissable-sql` | 2025-09-10 | RUNNABLE | `db-custom-1-3840` | 10 GB PD_SSD | Yes | Yes | Yes |
| `commissable-sql-clone` | 2025-12-08 | RUNNABLE | `db-custom-1-3840` | 10 GB PD_SSD | Yes | Yes | Yes |
| `commissable-sql-clone-2` | 2026-03-11 | RUNNABLE | `db-custom-1-3840` | 10 GB PD_SSD | Yes | Yes | Yes |
| `commissable-sql-pitr-20260311-200030` | 2026-03-11 | RUNNABLE | `db-custom-1-3840` | 10 GB PD_SSD | Yes | Yes | Yes |

## Cost context

Using live Cloud Billing catalog pricing in `us-central1` on 2026-03-12:

- Estimated floor per always-on instance: about `$58.31/month`
- Estimated floor for the 3 extra non-primary instances: about `$174.93/month`
- Estimated floor for all 4 current instances: about `$233.25/month`

This is a floor only. It excludes backup storage, PITR log storage, and network costs.

## Utilization summary

| Instance | 30d mean CPU | 24h max CPU | 30d mean memory | 24h mean backends | 24h max backends |
| --- | --- | --- | --- | --- | --- |
| `commissable-sql` | 11.1% | 61.7% | 29.0% | 7.51 | 57 |
| `commissable-sql-clone` | 9.2% | 11.4% | 60.8% | 0.02 | 1 |
| `commissable-sql-clone-2` | 10.0% | 85.7% | 60.1% | 0.07 | 1 |
| `commissable-sql-pitr-20260311-200030` | 10.6% | 94.9% | 59.9% | 0.02 | 1 |

Interpretation:

- `commissable-sql` is the only instance showing sustained application traffic.
- The two March 11 instances likely have noisy CPU spikes from clone or restore activity.
- The older December clone is the strongest evidence of an extra instance staying billable while effectively idle.

## What differs between the instances

### Configuration differences

- `commissable-sql` is in `us-central1-c`.
- The other 3 instances are in `us-central1-b`.
- `commissable-sql` and `commissable-sql-clone` are on PostgreSQL `15.15`.
- `commissable-sql-clone-2` and `commissable-sql-pitr-20260311-200030` are on PostgreSQL `15.16`.

### Operational history differences

- `commissable-sql-clone` was created by a `CLONE` operation on 2025-12-08.
- `commissable-sql-clone-2` was created by a `CLONE` operation on 2026-03-11.
- `commissable-sql-pitr-20260311-200030` has a PITR-style name, but Cloud SQL operation history shows it was also created by a `CLONE` operation on 2026-03-11.
- `commissable-sql` shows a `RESTORE_VOLUME` operation on 2026-03-11.

### What does not differ much

- Same machine shape
- Same disk type and disk size
- Same PITR enabled status
- Same Query Insights enabled status
- Same public IP posture
- Same visible databases
- Same visible users

## Data comparison in `commissable_crm`

I ran read-only metadata queries and exact row counts against the application database `commissable_crm` on:

- `commissable-sql`
- `commissable-sql-clone-2`
- `commissable-sql-pitr-20260311-200030`

### Primary vs `commissable-sql-clone-2`

This instance is close to primary, not identical.

- Public tables compared: `49`
- Tables with exact row-count differences: `4`
- Total rows across public tables:
  - `commissable-sql`: `911`
  - `commissable-sql-clone-2`: `881`

Largest exact differences:

| Table | Primary | Clone 2 | Delta |
| --- | --- | --- | --- |
| `AuditLog` | 413 | 391 | -22 |
| `UserSession` | 19 | 15 | -4 |
| `ReconciliationUndoLog` | 15 | 12 | -3 |
| `TablePreference` | 20 | 19 | -1 |

Database size was also very close:

- `commissable-sql`: about `16.17 MB`
- `commissable-sql-clone-2`: about `16.14 MB`

Interpretation:

- `commissable-sql-clone-2` looks like a near-current copy.
- It is slightly behind production, mostly in activity or session-style tables.
- It is reasonable as a temporary testing copy.
- It should not be used to overwrite production.

### Primary vs `commissable-sql-pitr-20260311-200030`

This instance is materially different from primary.

- Public tables compared: `49`
- Tables with exact row-count differences: `38`
- Total rows across public tables:
  - `commissable-sql`: `911`
  - `commissable-sql-pitr-20260311-200030`: `74`

Largest exact differences:

| Table | Primary | PITR-named instance | Delta |
| --- | --- | --- | --- |
| `AuditLog` | 413 | 0 | -413 |
| `RevenueSchedule` | 104 | 0 | -104 |
| `RolePermission` | 79 | 0 | -79 |
| `Permission` | 37 | 4 | -33 |
| `TablePreference` | 20 | 0 | -20 |
| `UserSession` | 19 | 0 | -19 |
| `Address` | 15 | 0 | -15 |
| `ReconciliationUndoLog` | 15 | 0 | -15 |
| `ProductSubtype` | 13 | 0 | -13 |
| `Account` | 12 | 2 | -10 |

Database size was smaller:

- `commissable-sql`: about `16.17 MB`
- `commissable-sql-pitr-20260311-200030`: about `13.93 MB`

Interpretation:

- This is not a drop-in equivalent of production.
- It looks more like an earlier or partial recovery copy than a current full-production test copy.
- It should not be used as the long-term testing instance.
- It should not be used to overwrite production.

## Production and local usage

### Local

Local development is confirmed to be using `commissable-sql`.

Evidence:

- Local env uses `DATABASE_URL` and `DIRECT_URL` against `127.0.0.1:5432/commissable_crm`.
- Local env sets `CLOUD_SQL_CONNECTION_NAME` to `groovy-design-471709-d1:us-central1:commissable-sql`.
- A running `cloud_sql_proxy.exe` process was observed targeting `groovy-design-471709-d1:us-central1:commissable-sql` on port `5432`.

Interpretation:

- Local development is currently pointed at production infrastructure through a local proxy.

### Live Vercel

I could not directly verify the current Vercel production environment variables from this machine because Vercel CLI credentials were not available.

What is known:

- The repo deployment guide points production to `commissable-sql`.
- I found no repo references to `commissable-sql-clone`, `commissable-sql-clone-2`, or `commissable-sql-pitr-20260311-200030`.

Interpretation:

- Vercel production likely uses `commissable-sql`, but that specific runtime value was not directly verified.

## Should production be updated from one of the clones?

No.

Reason:

- `commissable-sql` is currently ahead of both March 11 instances.
- `commissable-sql-clone-2` is slightly behind production.
- `commissable-sql-pitr-20260311-200030` is far behind production.

Operationally:

- Cloud SQL clones are separate instances, not a sync mechanism.
- Restoring over an existing instance is a recovery operation and would overwrite current data.
- That is the wrong cleanup tool unless you are intentionally performing a rollback.

## Recommended target state

Short term:

- Production: `commissable-sql`
- Testing: `commissable-sql-clone-2`

Long term:

- Production: `commissable-sql`
- Testing: a deliberately named instance such as `commissable-sql-test` or `commissable-sql-staging`

## Recommended cleanup sequence

### Lowest-risk path

1. Keep `commissable-sql` as production.
2. Treat `commissable-sql-clone-2` as the temporary test instance.
3. Confirm no one is actively using `commissable-sql-clone`.
4. Confirm no one is actively using `commissable-sql-pitr-20260311-200030`.
5. Delete `commissable-sql-clone` after confirmation.
6. Delete `commissable-sql-pitr-20260311-200030` after confirmation.

### Cleaner long-term path

1. Keep `commissable-sql` as production.
2. Create a fresh clone of `commissable-sql` with a permanent non-prod name.
3. Point testing and validation work to that named non-prod instance.
4. Retire `commissable-sql-clone-2` after the new test instance is validated.
5. Keep only one non-prod Cloud SQL instance unless there is a real operational reason for more.

## Extra cost and safety improvements

- Stop using production as the default local development database.
- Use one dedicated non-prod instance for testing instead of multiple ad hoc clones.
- Consider stopping the non-prod instance when idle if your workflow allows it.
- Consider disabling PITR on the non-prod instance if point-in-time recovery is not needed there.
- Enable deletion protection on production.
- Add clear naming and ownership conventions for recovery clones so they do not become long-lived cost leaks.

## Open items to verify later

- Confirm the current Vercel production environment variables directly in Vercel.
- Confirm whether any human workflow still depends on `commissable-sql-clone`.
- Confirm whether the 2026-03-11 recovery workflow is complete and `commissable-sql-pitr-20260311-200030` is no longer needed.
- Decide whether to keep `commissable-sql-clone-2` temporarily or replace it with a cleaner permanently named test instance.

## Related file

- Main audit: [2026-03-12-cloud-sql-cost-audit.md](c:/Users/Administrator/.cursor-projects/projects/commissable-crm-dev/docs/analysis/2026-03-12-cloud-sql-cost-audit.md)
