Staging DB setup (Step 1)

Pre-req
- Ensure pg_dump, pg_restore, psql are installed.
- Have PROD_URL, STAGING_ADMIN_URL, and a staging app password ready.

Backup prod and clone to staging
1) PowerShell (Windows):
   - .\\scripts\\clone_prod_to_staging.ps1 -ProdUrl "$env:PROD_URL" -StagingAdminUrl "$env:STAGING_ADMIN_URL" -StagingDbName "commissable_crm_staging" -StagingAppUser "commissable_staging" -StagingAppPassword "<password>" -DropExisting

2) Bash (macOS/Linux):
   - bash scripts/clone_prod_to_staging.sh --prod "$PROD_URL" --staging-admin "$STAGING_ADMIN_URL" --db commissable_crm_staging --user commissable_staging --pass '<password>' --drop-existing

Point app to staging (local/dev)
- Create .env.local using .env.staging.example. Set DATABASE_URL and DIRECT_URL to staging. Avoid committing secrets.
- Set SHADOW_DATABASE_URL to a disposable local DB (never prod).

Verification
- psql "$STAGING_URL" -c "SELECT now();"  (staging connectivity)
- npx prisma migrate status  (read-only validation; do not run migrate dev yet)

