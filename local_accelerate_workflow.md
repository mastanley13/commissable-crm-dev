# Cloud SQL Connector Workflow

This app now supports two modes:

## 1. Local development (direct Postgres connection)

1. Start the Cloud SQL Auth Proxy locally (or expose the database another way).
2. Create `.env.local` with:
   ```env
   USE_CLOUD_SQL_CONNECTOR=false
   DATABASE_URL=postgresql://app:commissable%402025@127.0.0.1:5432/commissable_crm
   ```
3. Run `npm install` (generates the classic Prisma client) and `npm run dev`.

## 2. Production / Preview (Cloud SQL Node.js Connector)

1. Provide the following env vars in Vercel/CI:
   ```env
   USE_CLOUD_SQL_CONNECTOR=true
   CLOUD_SQL_CONNECTION_NAME=groovy-design-471709-d1:us-central1:commissable-sql
   DB_USER=app
   DB_PASSWORD=commissable@2025
   DB_NAME=commissable_crm
   GCP_SA_KEY={"type":"service_account", ...}
   ```
2. Do **not** set `DATABASE_URL`; Prisma receives one at runtime from the connector.
3. Build/deploy normally (`npm run build`). Each serverless function starts the connector, opens a Unix socket under `/tmp/cloudsql/<instance>/.s.PGSQL.5432`, and Prisma connects through it.

## Switching modes

- Local ? Cloud SQL connector: set `USE_CLOUD_SQL_CONNECTOR=true`, remove/ignore `DATABASE_URL`, redeploy.
- Cloud SQL connector ? Local: set `USE_CLOUD_SQL_CONNECTOR=false`, define `DATABASE_URL`, restart `npm run dev`.

The helper in `lib/cloudsql.ts` ensures only one connector proxy starts per cold start. Route handlers continue to import `prisma` from `@/lib/db` with no changes.
