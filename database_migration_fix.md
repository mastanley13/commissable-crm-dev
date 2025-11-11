Here’s the simplest safe path to get you back to a clean Prisma state **without losing data**. Think “repair history first, then proceed.”

---

## What’s going on (plain English)

* Prisma keeps a **filesystem history** (`prisma/migrations/**`) and a **database history** (`_prisma_migrations` table).
* Your DB shows migrations that your repo is **missing**, and one migration file that was **edited after it ran**.
* Until those two histories match exactly, **do not** run `migrate dev` on any shared DB (staging/prod). Only use `migrate deploy` on shared DBs after history is repaired.

---

## The safe plan (Happy Path — you can recover the originals)

### 0) Guardrails

* **Do not** run `prisma migrate dev` against production.
* Use **separate DATABASE_URLs** for dev/staging/prod so you never target the wrong DB.
* Create a **new Git branch** for this fix.

### 1) Back up production now

Use your engine’s dump tool:

* **Postgres**: `pg_dump $PROD_URL > backup_<date>.sql`
* **MySQL**: `mysqldump --routines --events --single-transaction $PROD_URL > backup_<date>.sql`
* **SQLite**: copy the `.db` file

Also keep a quick export of the migration ledger:

```sql
SELECT migration_name, checksum, finished_at, applied_steps_count
FROM _prisma_migrations
ORDER BY finished_at;
```

### 2) Make a staging copy for a dry run

* Restore the prod backup into **staging** (new DB).
* Point `DATABASE_URL` to staging for all steps below. Treat prod as **read-only** for schema changes until the end.

### 3) Fix the “edited-after-apply” migration

The file cited:
`prisma/migrations/20250923090421_activities_module/migration.sql`

* Use Git to restore it to the **exact** contents that were originally applied (so the checksum matches):

  ```bash
  git log -- prisma/migrations/20250923090421_activities_module/migration.sql
  # find the commit that added/applied it, then:
  git checkout <that-commit> -- prisma/migrations/20250923090421_activities_module/migration.sql
  ```
* Commit the restore.

### 4) Restore the **missing migration folders** exactly

Folders mentioned:

* `20251001000000_add_group_is_active`
* `202410151200_add_active_to_opportunity_product`

Recover each **entire folder** (name + SQL file) from source control (or your build artifacts/CI tarballs). Example:

```bash
git checkout <commit-hash> -- prisma/migrations/20251001000000_add_group_is_active
git checkout <commit-hash> -- prisma/migrations/202410151200_add_active_to_opportunity_product
```

Commit these restores.

> Important: The **folder names and SQL contents must match exactly** what ran in production, or checksums won’t line up.

### 5) Verify status (on staging)

```bash
npx prisma migrate status
```

You want **no** “modified” and **no** “applied in DB, missing locally” messages.

### 6) Mark the already-applied “db push” change as applied

Your agent flagged this migration as already present in DB via `db push`:

* `20250207120000_add_reconciliation_templates`

Mark it **applied** so Prisma won’t try to re-run it:

```bash
npx prisma migrate resolve --applied 20250207120000_add_reconciliation_templates
```

### 7) Deploy and regenerate (still on staging)

```bash
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` should be a no-op if everything matches. That’s what you want.

### 8) Final checks

* `npx prisma validate` (schema OK)
* Optional: `npx prisma migrate diff --from-url $STAGING_URL --to-schema-datamodel prisma/schema.prisma`

  * Expect no meaningful differences.
* Smoke test your app on staging.

### 9) Repeat for production

Once staging is clean:

* Point `DATABASE_URL` to **production**
* Run:

  ```bash
  npx prisma migrate resolve --applied 20250207120000_add_reconciliation_templates
  npx prisma migrate deploy
  npx prisma generate
  ```

This should also be a no-op (or only mark-resolve). Data stays intact.

---

## If you **cannot** recover the original migration folders

This is the **baseline** escape hatch. It preserves your data but **replaces your migration history** going forward (you lose the ability to perfectly reproduce the past chain).

1. Point to **staging** (never do this first on prod).
2. Pull the live schema to your datamodel:

```bash
npx prisma db pull
```

3. Create a baseline migration from the **current** schema:

```bash
mkdir -p prisma/migrations/0000_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0000_init/migration.sql
```

4. Tell Prisma this baseline is **already applied**:

```bash
npx prisma migrate resolve --applied 0000_init
```

5. On staging:

```bash
npx prisma migrate deploy
npx prisma generate
```

6. When satisfied, repeat steps 4–5 on **production**.
   From here on, create **new** migrations normally; the old broken chain is replaced by `0000_init`.

> Only use the baseline route if you accept losing the old migration chain’s reproducibility. Your data remains as-is.

---

## Going forward (to avoid this again)

* **Local/dev:** `npx prisma migrate dev` (creates migrations)
* **Staging/prod:** `npx prisma migrate deploy` (applies existing migrations)
* Don’t edit old migrations; create new corrective migrations.
* Avoid `prisma db push` on shared DBs. Keep it for rapid local prototyping only.
* Always commit `prisma/migrations/**` and don’t prune them from the repo.

---

## Quick copy-paste checklist

```bash
# New branch
git checkout -b fix/prisma-history

# BACKUP PROD (engine-specific) and export _prisma_migrations if you want

# Use STAGING DATABASE_URL
export DATABASE_URL=<staging-connection-string>

# 1) Restore edited migration exactly
git checkout <commit> -- prisma/migrations/20250923090421_activities_module/migration.sql

# 2) Restore missing migrations exactly
git checkout <commit> -- prisma/migrations/20251001000000_add_group_is_active
git checkout <commit> -- prisma/migrations/202410151200_add_active_to_opportunity_product

# 3) Verify
npx prisma migrate status

# 4) Mark previously db-pushed migration as applied
npx prisma migrate resolve --applied 20250207120000_add_reconciliation_templates

# 5) Deploy + generate (staging)
npx prisma migrate deploy
npx prisma generate

# 6) Repeat resolve+deploy on production when staging is clean
export DATABASE_URL=<production-connection-string>
npx prisma migrate resolve --applied 20250207120000_add_reconciliation_templates
npx prisma migrate deploy
npx prisma generate
```

---

If you follow the **Happy Path** (restore exact files + mark the db-pushed one as applied), you keep **all data**, and Prisma returns to a healthy state. If originals can’t be found, use the **Baseline** path to lock in today’s schema as your new starting point—again, without touching your existing data.
