# Commissable CRM – Database Backup & Restore Strategy

This document defines how Commissable CRM’s PostgreSQL database is backed up and restored across environments. It is meant for engineers and operators who manage Cloud SQL, migrations, and incident response.

The goal is to keep this opinionated and executable: you should be able to follow it as a runbook before risky changes and during incidents.

---

## 1. Scope & Assumptions

- **Database**: PostgreSQL (Google Cloud SQL)
- **ORM**: Prisma (`prisma/schema.prisma`, `_prisma_migrations` table)
- **App**: Multi-tenant SaaS using a *single* logical DB with `tenantId` on all business tables.
- **Environments**:
  - **Prod**: Cloud SQL instance (authoritative data)
  - **Staging**: Clone of prod used for validation
  - **Dev/local**: Individual developer DBs, disposable
- **Existing tooling**:
  - `DEPLOYMENT_GUIDE.md`, `database_migration_fix.md`
  - `docs/staging-setup.md`
  - `scripts/clone_prod_to_staging.ps1`, `scripts/clone_prod_to_staging.sh`

This strategy focuses on **database-level** backup/restore. Application-level export/import features (e.g., CSV import/export) are complementary but do not replace DB backups.

---

## 2. Objectives (RPO/RTO)

Recommended targets (tune per business requirements):

- **Recovery Point Objective (RPO)**: ≤ 15 minutes
  - Achieved via **Cloud SQL automated backups + Point-In-Time Recovery (PITR)** and **pre-deploy logical dumps** before risky operations.
- **Recovery Time Objective (RTO)**: ≤ 2 hours for full DB incident
  - Achieved via **tested restore runbooks**, **staging rehearsal**, and **pre-baked clone scripts**.

These targets guide how frequently backups run, how long they’re retained, and how often restore procedures are tested.

---

## 3. Backup Types

### 3.1 Automated instance backups (Cloud SQL)

Primary protection for production:

- **Daily automated backups** in Cloud SQL with:
  - Fixed **backup window** during off-peak hours (e.g., `02:00` in instance time zone).
  - **Retention**: at least 7–30 days (align to compliance).
- **Point-In-Time Recovery (PITR)** enabled to cover gaps between daily snapshots.

These are managed on the Cloud SQL instance itself and are the first choice for disaster recovery.

### 3.2 Logical dumps before risky changes

Before any high-risk operation on prod (schema migrations, bulk data fixes, destructive scripts), take a **logical backup**:

- Use `pg_dump` against **prod**:
  - Custom format (`--format=custom`) for flexible restore.
  - Stored under a controlled `backups/` path or secure bucket.
- This is explicitly called out in `database_migration_fix.md` and is reinforced here as a **non-negotiable precondition** for:
  - Manual SQL changes
  - Prisma migration chains that touch critical tables
  - Bulk update/delete scripts

### 3.3 Environment clone backups

The scripts:

- `scripts/clone_prod_to_staging.ps1`
- `scripts/clone_prod_to_staging.sh`

already implement a combined **backup + clone-to-staging** workflow:

- Dumps prod to a file like `backups/backup_YYYYMMDD_HHmm_prod.dump`.
- Creates a staging DB.
- Restores the backup into staging with a dedicated app user.

These scripts double as:

- A tested **“restore to new DB”** path.
- A way to continuously validate that prod backups are restorable.

---

## 4. Environment-Specific Strategy

### 4.1 Production

**Requirements**

- Cloud SQL instance must have:
  - **Automated backups enabled**
  - **PITR enabled** (if available for the instance tier)
  - **Backup window** set to off-peak
  - **Retention policy** meeting business/compliance (e.g., 30 days)
- Access to manage backups only for:
  - GCP roles restricted to SREs/lead engineers
  - In-app permissions (`admin.backup`, `admin.restore`) should mirror this at the UI level but **do not grant Cloud SQL rights by themselves**.

**Change Management**

- Before any schema migration or bulk data change on prod:
  1. Confirm a **recent automated backup** exists and is healthy.
  2. Take an additional **logical `pg_dump` backup** with a clear name (see section 5.2).
  3. Run changes only after the backup is confirmed and stored in a safe location.

### 4.2 Staging

**Purpose**

- Validate migrations and restore procedures.
- Rehearse incident scenarios safely.

**Strategy**

- Treat **staging as disposable**:
  - Recreate from prod using the clone scripts when needed.
  - Do **not** run `prisma migrate dev` on staging; use `migrate deploy` only (as described in `database_migration_fix.md` and `DEPLOYMENT_GUIDE.md`).
- Automated backups on staging:
  - Optional, but recommended for:
    - Testing restore procedures without touching prod.
    - Debugging issues from recent test runs.

### 4.3 Development / Local

- Developers typically use:
  - Local Postgres with data seeded from fixtures or sanitized dumps.
- Backups are **developer responsibility**:
  - Local DBs are not considered part of the official backup strategy.
  - Developers can pull sanitized dumps from staging or prod (subject to data governance rules) and restore locally as needed.

---

## 5. Operational Procedures

### 5.1 Configure automated backups in Cloud SQL

Configure on the production instance (example using `gcloud`, adjust to your project/instance):

- Enable daily backups with a retention policy:
  - Set via Cloud Console or `gcloud sql instances patch`.
- Enable **PITR** (if supported):
  - Configure WAL retention to cover your RPO (e.g., 7–30 days).

Key requirements:

- Backups must be **encrypted** (Cloud SQL does this by default; use CMEK if mandated).
- Ensure backup/snapshot **logs and alerts** are wired into your monitoring system so failures are visible.

> Detailed Cloud SQL backup commands and troubleshooting steps live in `Markdown-Notes/GCloud_SQL_Troubleshoot_guide.md`. This document defines the policies; that file can hold deeper command examples.

### 5.2 Take a logical backup before risky operations

Logical backups are taken from an operator machine with access to prod via Cloud SQL Proxy or direct connection.

**Inputs**

- `PROD_URL` – full Postgres URL for prod (same format as `DATABASE_URL`).
- `backups/` directory (in repo or a secure mount on the operator machine).

**Best practices**

- Use a timestamped and descriptive file name, e.g.:
  - `backups/backup_YYYYMMDD_HHmm_prod_before_<change>.dump`
- Use `--format=custom` and **exclude ownership/privileges** so restore is easier:
  - This is already baked into `scripts/clone_prod_to_staging.*`; reuse that pattern.
- Store backups in **secure, access-controlled storage** (e.g., encrypted disk or GCS bucket); they contain full tenant data.

### 5.3 Restore backup to a non-prod database

This is the **primary restore test path** and the safest way to inspect backup contents.

Use:

- PowerShell: `scripts/clone_prod_to_staging.ps1`
- Bash: `scripts/clone_prod_to_staging.sh`

Both scripts:

- Create (or recreate) a staging DB.
- Ensure a staging app user exists with required privileges.
- Restore from the specified backup file.
- Print example `DATABASE_URL` and `DIRECT_URL` for `.env.local`.

Reference: `docs/staging-setup.md` for step-by-step instructions to:

- Run the script.
- Point the app to staging.
- Validate connectivity and Prisma migrations (`npx prisma migrate status`).

Use this flow to:

- Rehearse **disaster recovery**.
- Validate data after a backup.
- Debug production data issues without touching prod.

### 5.4 Disaster Recovery – restoring production

When prod data is corrupted or lost, prefer **restoring into a new instance**, not overwriting the existing one:

1. **Identify the restore target time**
   - Based on incident timeline and RPO.
2. **Create a new Cloud SQL instance** from:
   - An automated backup, or
   - A PITR timestamp.
3. **Run smoke tests** on the new instance:
   - Use `psql` or Prisma (`npx prisma db pull`, `npx prisma validate`).
   - Optionally deploy the app against this instance in a **temporary environment**.
4. **Swap traffic**
   - Update environment variables (`DATABASE_URL`, `DIRECT_URL`) for prod to point at the new instance.
   - Restart the app/processes.
5. **Post-incident**
   - Preserve the old instance for forensic analysis until safe to decommission.

Overwriting the existing prod instance with a backup should be considered **last resort only** and requires explicit approval because it removes the ability to compare “before” vs. “after” states.

### 5.5 Tenant-level recoveries (current limitations)

The schema is **multi-tenant in a single DB** (tenant isolation via `tenantId`). Today there is **no automated, tenant-level restore mechanism**.

If a single tenant needs partial recovery (e.g., accidental deletion of its records), the recommended approach is:

1. Restore the relevant backup into a **temporary database** (using the same restore-to-staging pattern).
2. Use SQL or scripts to extract affected rows for one `tenantId`.
3. Carefully re-insert/update data in prod for that tenant, with:
   - Transaction boundaries,
   - Data validation checks,
   - Application-layer invariants respected.

If per-tenant restore becomes a formal requirement, design and document a dedicated workflow and automation for it.

---

## 6. Security, Access & Compliance

### 6.1 Who can manage backups

- Cloud SQL backup/restore operations:
  - GCP IAM roles restricted to database/SRE owners.
- Application “Data Management” UI:
  - `admin.backup` and `admin.restore` permissions (see `scripts/add-data-management-permissions.ts` and `app/(dashboard)/admin/data-management/page.tsx`).
  - Today these permissions should be treated as **UI-level capabilities only**; actual backup operations still require Cloud SQL / infra access.

Do **not** allow general app users to trigger or download full DB backups.

### 6.2 Storage and encryption

- All backups (Cloud SQL and logical dumps) must be:
  - Encrypted at rest (Cloud SQL default; verify for any external storage).
  - Transmitted over TLS when moved.
- If backups are copied to object storage (e.g., GCS buckets):
  - Bucket must be private with strict IAM.
  - Lifecycle rules should enforce retention and secure deletion.

### 6.3 Secrets handling

- Do not embed passwords or secrets into backup file names or paths.
- Tight control of:
  - `DATABASE_URL`, `DIRECT_URL`, `PROD_URL`, `STAGING_ADMIN_URL`, etc.
- `.env` files with database credentials must not be committed to source control.

---

## 7. Monitoring & Testing

### 7.1 Monitoring backups

- For Cloud SQL:
  - Enable alerts for **failed backups**.
  - Periodically review logs or dashboards for backup status.
- For logical dumps:
  - Scripts should log:
    - Backup file path.
    - Start/end times.
    - Exit codes.

### 7.2 Regular restore tests

To ensure that backups are not only taken but **usable**, schedule regular restore tests:

- At least **monthly**:
  - Use the clone scripts to restore a recent prod backup into staging.
  - Run the app against staging and perform a short smoke test (login, key flows like deposit upload/reconciliation).
- After major schema changes:
  - Validate that a backup taken before the change can still be restored correctly to a fresh database.

Document the outcome of each test (pass/fail, issues found) in internal runbooks or tickets.

---

## 8. Integration with the Data Management UI

The Data Management Center (`app/(dashboard)/admin/data-management/page.tsx`) exposes options for:

- **Data Backup** (`admin.backup`)
- **Data Restore** (`admin.restore`)

Current state:

- These cards are **conceptual entry points**; the actual backup/restore work is still performed via Cloud SQL and scripts.

Recommended future direction:

- Wire the UI to:
  - Trigger **predefined, audited operations** (e.g., enqueue a job that runs `pg_dump` on the server side, stores result in secure storage, and records a record in a `Backups` table).
  - List existing backups (metadata only) for visibility.
  - Allow **restore-to-staging** flows from the UI for non-DBAs.
- Any such feature must:
  - Respect `admin.backup` / `admin.restore` permissions.
  - Never expose raw backup files directly to the browser.

This document remains the source of truth for **what is allowed**; UI features should implement these policies, not invent new ones.

---

## 9. Checklist Summary

Use this as a quick-reference checklist.

**Before major schema/data changes on prod**

- [ ] Confirm Cloud SQL automated backups & PITR are enabled and healthy.
- [ ] Take a fresh `pg_dump` logical backup with timestamped name.
- [ ] If feasible, rehearse the change on staging using a recent backup.

**Monthly / regular maintenance**

- [ ] Verify latest backups exist and complete successfully.
- [ ] Run a restore-to-staging test using the clone scripts.
- [ ] Smoke test critical flows on staging (auth, deposits, reconciliation, revenue schedules).

**During a disaster recovery event**

- [ ] Identify incident start time and acceptable data loss window (RPO).
- [ ] Restore to a **new Cloud SQL instance** using backup/PITR.
- [ ] Validate schema and data on the new instance.
- [ ] Point prod app to the new instance and monitor.
- [ ] Preserve the old instance for analysis until decommissioned.

This strategy should evolve as the product matures (e.g., adding per-tenant restore, automated backups surfaced in the UI). Update this document whenever the actual operational procedures change.

