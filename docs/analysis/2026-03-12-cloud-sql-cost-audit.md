# Google Cloud SQL Cost Audit

Date: 2026-03-12

## Scope and guardrails

- This was a read-only audit of the repo plus read-only Google Cloud metadata.
- I did not modify Cloud SQL, enable APIs, change instance settings, or run destructive database commands.
- I did not enable the Recommender API when I found it disabled, because that would have changed project state.

## Executive summary

The biggest Cloud SQL savings opportunity is not query tuning. It is infra hygiene.

- The project currently has **4 runnable Cloud SQL PostgreSQL instances** in `us-central1`, not just the primary:
  - `commissable-sql`
  - `commissable-sql-clone`
  - `commissable-sql-clone-2`
  - `commissable-sql-pitr-20260311-200030`
- All 4 are `RUNNABLE`, `ALWAYS` on, `db-custom-1-3840`, `PD_SSD`, `10 GB`, public IPv4 enabled, PITR enabled, and Query Insights enabled.
- A conservative cost floor from the live Cloud Billing catalog is about **$58.31/month per always-on instance** before backup/PITR storage and network egress.
- That implies the **3 extra non-primary instances are likely costing at least about $174.93/month** on their own, and the 4-instance footprint is at least about **$233.25/month** before backup/PITR/network charges.
- The **primary instance is not obviously wildly oversized**. It is already on a small `1 vCPU / 3.75 GiB` shape, with:
  - 30-day mean CPU about `11.1%`
  - 24-hour max CPU about `61.7%`
  - 30-day mean memory about `29.0%`
  - 30-day mean disk utilization about `1.41%`
- Storage is not the current cost problem. Extra always-on instances, backup duplication, public IP usage, and connection inefficiency are.

## What I examined

### Read-only cloud data

- `gcloud sql instances list`
- `gcloud sql databases list --instance commissable-sql`
- `gcloud sql users list --instance commissable-sql`
- Cloud Monitoring REST API for CPU, memory, disk, and backend counts
- Cloud Billing Catalog API for live Cloud SQL SKUs in `us-central1`

### Repo paths reviewed

- `lib/cloudsql.ts`
- `lib/db.ts`
- `lib/auth.ts`
- `lib/api-auth.ts`
- `lib/auth-context.tsx`
- `app/layout.tsx`
- `prisma/schema.prisma`
- `tests/integration-test-helpers.ts`
- `docs/specs/DATABASE_SCHEMA_DESIGN.md`
- `vercel.json`

## Current Cloud SQL footprint

### Instance inventory

From `gcloud sql instances list` on 2026-03-12:

| Instance | Created | State | Tier | Activation | Disk | PITR | Insights | Public IP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `commissable-sql` | 2025-09-10 | RUNNABLE | `db-custom-1-3840` | ALWAYS | 10 GB PD_SSD | Yes | Yes | Yes |
| `commissable-sql-clone` | 2025-12-08 | RUNNABLE | `db-custom-1-3840` | ALWAYS | 10 GB PD_SSD | Yes | Yes | Yes |
| `commissable-sql-clone-2` | 2026-03-11 | RUNNABLE | `db-custom-1-3840` | ALWAYS | 10 GB PD_SSD | Yes | Yes | Yes |
| `commissable-sql-pitr-20260311-200030` | 2026-03-11 | RUNNABLE | `db-custom-1-3840` | ALWAYS | 10 GB PD_SSD | Yes | Yes | Yes |

### Primary instance databases

From `gcloud sql databases list --instance commissable-sql`:

- `postgres`
- `crm`
- `commissable_crm`

### Important observation

- I found **no repo references** to the 3 extra instance names (`commissable-sql-clone`, `commissable-sql-clone-2`, `commissable-sql-pitr-20260311-200030`).
- That does not prove they are unused, but it strongly suggests they are not first-class app dependencies defined in this codebase.

## Instance comparison for removal decisions

This combines instance configuration, Cloud SQL operation history, and observed backend usage as of 2026-03-12. "Likely role" is an inference from naming, create history, and traffic patterns; it is not proof that no external workflow depends on an instance.

### Side-by-side comparison

| Instance | Likely role | Created / origin | What is different from the primary | 24h backend usage | Removal view |
| --- | --- | --- | --- | --- | --- |
| `commissable-sql` | Primary application database | Created 2025-09-10. Had a `RESTORE_VOLUME` operation on 2026-03-11. | Lives in `us-central1-c`; PostgreSQL `15.15`; this is the only instance with sustained app traffic. | Mean `7.51`, max `57` | Keep. Do not treat this as a cleanup candidate unless there is a separate production cutover plan. |
| `commissable-sql-clone` | Older full clone | Created by `CLONE` on 2025-12-08. | Same size, disk, PITR, Insights, public IP, DB names, and users as primary. Runs in `us-central1-b`. Same PostgreSQL `15.15` patch family as primary. | Mean `0.02`, max `1` | Highest-priority review candidate. Strongest case for removal if no human workflow still depends on it. |
| `commissable-sql-clone-2` | Newer temporary clone | Created by `CLONE` on 2026-03-11. | Same shape and settings as primary. Runs in `us-central1-b`. Newer PostgreSQL `15.16` patch family. | Mean `0.07`, max `1` | High-priority review candidate. Likely temporary unless it is still being used for validation after the 2026-03-11 recovery work. |
| `commissable-sql-pitr-20260311-200030` | Recovery copy | Name suggests PITR, but the instance was actually created by `CLONE` on 2026-03-11. | Same shape and settings as primary. Runs in `us-central1-b`. Newer PostgreSQL `15.16` patch family. | Mean `0.02`, max `1` | High-priority review candidate once the 2026-03-11 recovery or inspection activity is confirmed complete. |

### What is actually different?

- **Age:** the primary dates to 2025-09-10, the oldest extra clone to 2025-12-08, and the two newest copies to 2026-03-11.
- **Zone:** the primary is in `us-central1-c`; all 3 extra instances are in `us-central1-b`.
- **Patch level:** the primary and old clone are on PostgreSQL `15.15`; the two 2026-03-11 copies are on PostgreSQL `15.16`.
- **Operational origin:** `commissable-sql-clone`, `commissable-sql-clone-2`, and `commissable-sql-pitr-20260311-200030` were all created via `CLONE`; the primary shows a `RESTORE_VOLUME` event on 2026-03-11.
- **Observed usage:** only `commissable-sql` shows sustained application backend usage. All 3 extra instances are effectively idle from an app-connection perspective.

### What is not different?

- All 4 instances are `db-custom-1-3840`, `ZONAL`, `ALWAYS` on, and backed by `10 GB` of `PD_SSD`.
- All 4 have PITR enabled, Query Insights enabled, public IPv4 enabled, and SSL mode `ALLOW_UNENCRYPTED_AND_ENCRYPTED`.
- All 4 expose the same visible databases (`postgres`, `crm`, `commissable_crm`) and the same visible users (`app`, `commissable_admin_app_user`, `postgres`).

### Practical review order

1. Review `commissable-sql-clone` first. It is the oldest non-primary copy and the clearest "idle but billable" candidate.
2. Review `commissable-sql-clone-2` second. It looks like a same-day temporary clone from the 2026-03-11 activity.
3. Review `commissable-sql-pitr-20260311-200030` third. It also looks temporary, but its name implies recovery intent, so validate that nobody is still inspecting it.
4. Keep `commissable-sql` out of the cleanup list unless you are deliberately replacing production.

## Utilization snapshot

### Monitoring summary

From Cloud Monitoring on 2026-03-12:

| Instance | 30d mean CPU | 24h max CPU | 30d mean memory | 30d mean disk | 24h mean backends (`commissable_crm`) | 24h max backends (`commissable_crm`) |
| --- | --- | --- | --- | --- | --- | --- |
| `commissable-sql` | 11.1% | 61.7% | 29.0% | 1.41% | 7.51 | 57 |
| `commissable-sql-clone` | 9.2% | 11.4% | 60.8% | 1.36% | 0.02 | 1 |
| `commissable-sql-clone-2` | 10.0% | 85.7% | 60.1% | 1.52% | 0.07 | 1 |
| `commissable-sql-pitr-20260311-200030` | 10.6% | 94.9% | 59.9% | 1.56% | 0.02 | 1 |

Notes:

- The two instances created on 2026-03-11 have short-lived metrics, so their CPU max is likely polluted by clone/restore activity.
- The older clone from 2025-12-08 is more informative: it shows **near-zero application backends** while still incurring full baseline instance cost.
- Disk usage is tiny across all instances. The expensive part is mostly **instance-hours**, not data size.

## Cost estimate

### Conservative monthly floor per instance

Using the live Cloud Billing Catalog in `us-central1` on 2026-03-12:

- PostgreSQL Enterprise N4 vCPU: `$0.0413/hour`
- PostgreSQL Enterprise N4 RAM: `$0.007/GiB-hour`
- Public IP reservation: `$0.01/hour`
- 10 GB storage floor estimate: about `$1.70/month`

For the current `db-custom-1-3840` shape:

- 1 vCPU
- 3.75 GiB RAM
- 10 GB disk

Estimated floor:

- **Per always-on instance:** about **$58.31/month**
- **3 extra instances:** about **$174.93/month**
- **All 4 current instances:** about **$233.25/month**

What this estimate does **not** include:

- automated backup storage
- PITR log storage
- network egress
- any incidental monitoring/logging overhead

So actual spend is likely higher than the floor.

## Findings

### 1. The clearest savings opportunity is retiring or stopping extra instances

Evidence:

- All 4 Cloud SQL instances are `RUNNABLE` and `ALWAYS` on.
- The older clone, `commissable-sql-clone`, has almost no application backend usage.
- All 3 non-primary instances carry the same PITR/backup/public-IP posture as the primary.

Impact:

- This is the single highest-confidence cost issue in the environment.
- Even if app traffic were perfectly optimized, those extra instance-hours would still be billed.

Recommendation:

- Review the 3 non-primary instances first:
  - `commissable-sql-clone`
  - `commissable-sql-clone-2`
  - `commissable-sql-pitr-20260311-200030`
- If they are no longer needed, delete them.
- If they are needed only occasionally, stop them by default and only run them during active use.
- For temporary restore/validation environments, set owner, purpose, and TTL labels and use an expiration checklist.

Expected savings:

- Removing the 3 extra instances should save about **$174.93/month plus backup/PITR/network costs**.
- Stopping them should save at least the compute portion while stopped, though storage and some other charges can remain.

### 2. Temporary instances are carrying full backup/PITR overhead

Evidence:

- Every instance, including the two created on 2026-03-11, has:
  - automated backups enabled
  - PITR enabled
  - transaction log retention enabled
  - Query Insights enabled

Impact:

- This is sensible for the primary.
- It is often unnecessary for short-lived clones or PITR validation environments.
- Backup and PITR storage costs stack on top of the base instance cost.

Recommendation:

- For ephemeral clone/restore environments, use a lighter policy:
  - no automated backups unless required
  - no PITR unless that environment itself is business-critical
  - no long-lived instance retention without an owner

### 3. The primary instance is not the main right-sizing problem

Evidence:

- Primary is already `db-custom-1-3840`, which is a small shape.
- CPU and memory utilization do not suggest severe over-provisioning.
- Disk utilization is very low, but storage cost is also a small line item here.

Impact:

- There may be limited savings from shrinking the primary further.
- The larger near-term savings are elsewhere.

Recommendation:

- Do **not** start with a risky primary downsize.
- Keep the primary size stable unless you collect more workload evidence over time and prove a smaller shape is safe.

### 4. The runtime path does not use a real pooling tier for serverless-style traffic

Evidence:

- `prisma/schema.prisma:5-8` defines both `url` and `directUrl`.
- `docs/specs/DATABASE_SCHEMA_DESIGN.md:246-248` explicitly says to prepare `DIRECT_URL` for PgBouncer or Prisma Accelerate.
- `lib/db.ts:19-47` creates a `PrismaClient` directly against either the generated connector URL or `DATABASE_URL`.
- I found no runtime evidence of:
  - PgBouncer
  - Prisma Accelerate
  - explicit connection-limit tuning in the connection string

Impact:

- A Prisma singleton helps inside one warm process.
- It does **not** solve connection fan-out when multiple serverless instances cold-start in parallel.
- This matters more because the repo is configured for Vercel (`vercel.json:1-8`) and there are many API routes that can trigger database access.

Additional signal:

- `rg` found **115 API route files** using `withAuth()`, `withPermissions()`, or `withRole()`.

Recommendation:

- If the app stays on Vercel, add a proper pooling strategy:
  - PgBouncer in front of Cloud SQL
  - Prisma Accelerate if the economics work for your traffic profile
- If the backend moves to Cloud Run in the same region as Cloud SQL, use private IP plus a pooled connection strategy there.
- I would **not** make Cloud SQL Managed Connection Pooling the first cost-saving move here because Google documents it as an **Enterprise Plus** feature, which can increase base instance cost.

### 5. Auth/session handling is creating avoidable database chatter

Evidence:

- `lib/auth.ts:132-147` loads the session and then updates `lastSeenAt` on every authenticated request.
- `lib/api-auth.ts:23-32` calls `getAuthenticatedUser()` for protected API traffic.
- `app/layout.tsx:23-27` wraps the entire app in `AuthProvider`.
- `lib/auth-context.tsx:95-112` calls `/api/auth/me` during initial client auth bootstrapping.

Impact:

- Many page loads and protected API calls pay for:
  - session lookup
  - session write
  - user lookup
  - role/permission load
- This increases connection use, write IOPS, and query count without adding direct business value on every request.

Recommendation:

- Throttle `lastSeenAt` writes so they occur at most once per 5 to 15 minutes per session.
- Avoid forcing a full `/api/auth/me` round-trip on routes that do not need it immediately.
- Consider reducing permission hydration frequency if role data is not changing often.

### 6. Connectivity is hard-coded around the public path

Evidence:

- `lib/cloudsql.ts:30-34` starts the connector with `IpAddressTypes.PUBLIC`.
- The primary instance is configured with public IPv4 enabled and `ALLOW_UNENCRYPTED_AND_ENCRYPTED`.
- `docs/specs/DATABASE_SCHEMA_DESIGN.md:246-247` says production connectivity should prefer Cloud SQL Proxy or private IP plus pooling.

Impact:

- If compute is outside GCP or not co-located with the DB region, you can pay avoidable egress and latency.
- Each extra public IP also has a direct hourly cost.

Recommendation:

- If the application backend is moved onto GCP in or near `us-central1`, switch to private IP and remove public-IP dependence where practical.
- If the app stays on Vercel, at least pin runtime regions as close as possible to `us-central1` and reduce connection churn so the public path is used less aggressively.

### 7. Test or disposable database activity may be sharing the primary Cloud SQL infrastructure

Evidence:

- `tests/integration-test-helpers.ts:17-28` requires `TEST_DATABASE_URL` and explicitly expects a disposable Postgres database.
- `tests/integration-test-helpers.ts:90-106` truncates nearly all tables in that target database.
- Cloud Monitoring showed backend metrics for `commissable_crm_codex_flex_naming_test` on the **primary** instance within the last 7 days.
- `docs/tasks/development-report-template.md:194` and `docs/tasks/development-report-template.md:594` also describe disposable test DB usage; `docs/tasks/development-report-template.md:331` references that test database name explicitly.

Impact:

- Disposable or scratch test workloads running on the main Cloud SQL instance add cost and operational risk.
- Even if the workload is light, it mixes production-like infra with non-production lifecycle patterns.

Recommendation:

- Keep disposable integration DBs off the main instance.
- Use one of:
  - local Postgres for most integration work
  - a dedicated dev/test Cloud SQL instance
  - a fully disposable database lifecycle in a non-primary environment

## What is probably causing higher cost today

In order of confidence:

1. **Three extra always-on Cloud SQL instances**
2. **Backups and PITR enabled on short-lived clone/restore instances**
3. **Public IP billing on every instance**
4. **No external pooling layer for serverless-style Prisma traffic**
5. **Session write amplification on authenticated requests**
6. **Possible disposable test DB traffic hitting primary Cloud SQL infrastructure**
7. **Possible cross-region/public network path between Vercel-hosted app traffic and `us-central1` Cloud SQL**

## What I would do first

### Priority 1

- Review and retire the 3 non-primary instances if they are not actively needed.
- If they must exist, stop them when idle and assign owner/purpose/TTL labels.

### Priority 2

- Keep the primary instance size unchanged for now.
- Focus savings effort on reducing connection waste before attempting primary downsizing.

### Priority 3

- Introduce real connection pooling for production app traffic.
- Use `DIRECT_URL` intentionally instead of leaving pooling as a documented-but-unused idea.

### Priority 4

- Throttle session heartbeat writes (`lastSeenAt`).
- Reduce unnecessary auth bootstrapping traffic where possible.

### Priority 5

- Move disposable integration databases off the main Cloud SQL instance.

### Priority 6

- If backend compute is or will be on GCP, plan a private-IP path and co-locate compute with the database region.

## Savings view

### High-confidence savings

- **Delete 3 extra always-on instances:** about **$174.93/month floor savings**, likely more after backup/PITR/network effects

### Medium-confidence savings

- **Stop temporary instances by default:** meaningful compute savings, but not as complete as deletion
- **Disable PITR/backups on ephemeral clones:** reduces non-compute storage costs
- **Reduce public-path/connection churn:** lowers DB overhead and may reduce egress-related cost exposure

### Lower-confidence or secondary savings

- **Shrinking the primary instance:** possible, but not the best first move based on current evidence

## Limitations

- I did not query Cloud Billing export data, so this audit estimates current cost from live catalog pricing and observed config rather than your exact invoice.
- I could not use Cloud SQL Recommender because `recommender.googleapis.com` is disabled, and I intentionally did not enable it.
- The newer clone instances were created on 2026-03-11, so their short-window CPU metrics are less reliable than the older clone's near-zero backend count.
- I could not prove the exact runtime region used by production Vercel traffic from this repo alone.

## References

- Cloud SQL pricing: https://cloud.google.com/sql/pricing
- Manage database connections: https://cloud.google.com/sql/docs/postgres/manage-connections
- Managed Connection Pooling overview: https://cloud.google.com/sql/docs/postgres/managed-connection-pooling
- Start, stop, and restart instances: https://cloud.google.com/sql/docs/postgres/start-stop-restart-instance
- Cloud SQL recommendations overview: https://cloud.google.com/sql/docs/postgres/recommender-sql-overview
