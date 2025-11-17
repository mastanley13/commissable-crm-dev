<!-- 2bc63739-00a3-4988-aa4e-17e4938e9b51 f3fe7b37-a640-4561-b1a4-a05fc68be0ac -->
# Login 500 Resolution Plan

## Implementation Steps

1. Confirm DB credentials and role

   - Review `process.env.DATABASE_URL` / DB user docs to verify which Postgres role the API uses (likely `commissable_admin_app_user`).
   - Ensure you have credentials for a superuser (e.g., `postgres`) that can grant schema privileges.

2. Connect to the database

   - Use `gcloud sql connect commissable-sql --user=postgres --database=commissable_crm` or Cloud Shell’s “Connect” action to open a `psql` session against production/staging.
   - If local proxy is required, follow `Cloud_SQL_Proxy_Launch_Guide.md` to start it before running `psql`.

3. Grant schema/table/sequence privileges

   - Run the SQL block documented in `Markdown-Notes/Grant_Context.md`:
     ```sql
     GRANT USAGE ON SCHEMA public TO commissable_admin_app_user;
     GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO commissable_admin_app_user;
     GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO commissable_admin_app_user;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO commissable_admin_app_user;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public
       GRANT ALL PRIVILEGES ON SEQUENCES TO commissable_admin_app_user;
     ```

   - Repeat for any other schemas if data lives outside `public`.

4. Restart the Next.js API (optional but recommended)

   - Redeploy Vercel or restart `npm run dev` to drop stale DB connections and pick up new privileges.

5. Verify the login flow

   - Hit `/api/auth/login` (or use the UI) with known credentials and ensure it now returns 200 or 401 instead of 500.
   - Check server logs for any new `permission denied` messages; if they mention other tables, grant the same privileges for those schemas.

## Implementation Todos

- confirm-db-role: Verify DB user used by the API
- connect-db: Open privileged session to the Postgres instance
- grant-privileges: Execute GRANT statements from `Grant_Context.md`
- restart-api: Restart/redeploy Next.js server (if needed)
- re-test-login: Run `/api/auth/login` and confirm success