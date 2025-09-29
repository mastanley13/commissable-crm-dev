Great news: the connector is now working—the runtime is actually talking to Postgres. The new error is a plain database permission issue:

Postgres error 42501: permission denied for table "Tenant"
The database credentials you configured (DB_USER=commissable_admin_app_user) don’t have SELECT permission on the Tenant table (or possibly the entire schema). To fix it, grant the necessary privileges to that role in Cloud SQL:

Connect to the instance (Cloud SQL Auth Proxy, Cloud Shell, or any SQL client) as a superuser.

Run:

GRANT USAGE ON SCHEMA public TO commissable_admin_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO commissable_admin_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO commissable_admin_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO commissable_admin_app_user;
(Adjust if your schema name isn’t public.)

Redeploy (or just re-run the API). Prisma will now be able to run tenant.findFirst() and the login flow should succeed.

If you also run migrations under that user, add CREATE privileges, but SELECT/INSERT/UPDATE/DELETE + USAGE is enough for the app as-is.

So the connector is set up correctly; we just needed to let the database user read the tables.

I want you to connect to the instance and run the command for me. Complete as much of this as you can. Let me know what you couldn't do, what I need to do to complete then test


I don’t have direct access to your Cloud SQL instance, so I can’t run those GRANT statements for you. Here’s exactly how you can do it; once the permissions are granted, the production login flow you already tested will stop throwing the “permission denied for table Tenant” error.

What you need

The Cloud SQL instance name: commissable-sql
Database name: commissable_crm
A superuser (or any Postgres role with sufficient privileges to grant rights). If you used the default postgres user when you set up the instance, that works.
The password for that superuser.
gcloud CLI (recommended), or Cloud SQL Auth Proxy, or a SQL client that can connect to Cloud SQL.
Run the GRANTs

Connect to the database

Using gcloud from your machine (replace postgres with whatever privileged account you have and supply its password when prompted):

gcloud sql connect commissable-sql --user=postgres --database=commissable_crm
If you don’t have gcloud set up, open the Google Cloud Console → SQL → commissable-sql → “Connect using Cloud Shell” and run the same psql commands there.

Execute the SQL

Once you’re inside psql, run:

GRANT USAGE ON SCHEMA public TO commissable_admin_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO commissable_admin_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO commissable_admin_app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO commissable_admin_app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO commissable_admin_app_user;
These commands:

allow the commissable_admin_app_user to access existing tables/sequences;
make sure any future tables/sequences inherit the same privileges.
Exit psql (type \q).

Next steps / testing

Redeploy to Vercel (or trigger a re-run) so the functions pick up any logic changes. No new deployment is strictly required for the permission change, but redeploying ensures a clean restart.
Hit the production login page again. The prisma.tenant.findFirst() call is the very first query; if the permissions are correct, the login should now succeed.
If the API still throws a database error, grab the latest Vercel function log (it’ll now point to a different table/sequence if anything else needs access).
After you’ve run those GRANTs, let me know if you see any new errors. At this point the only remaining blockers would be table-specific permissions or application logic.