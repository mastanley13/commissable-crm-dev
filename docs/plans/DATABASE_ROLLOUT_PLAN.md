# Database Rollout Plan

## Phase 1 – Local Baseline
- [x] Remove legacy migration folder (`prisma/migrations/20250916172833_init`) and commit fresh baseline
- [x] Run `npx prisma migrate reset --skip-seed` to drop old objects locally
- [x] Create new baseline migration: `npx prisma migrate dev --name baseline`
- [x] Verify generated SQL matches Cloud SQL capabilities (no unsupported features)

## Phase 2 – Seed & Verification
- [x] Run `npm run db:seed` to load starter data (tenant, roles, permissions, demo account)
- [x] `npx prisma studio` smoke test (Accounts, Contacts, Opportunities populated)
  - QA logins seeded via `prisma/seed.ts`: admin@commissable.test, manager@commissable.test, sales@commissable.test, finance@commissable.test
- [x] Document seeded credentials (see `seed.ts` addresses) for QA logins

## Phase 3 – Cloud SQL Deployment
- [ ] Start Cloud SQL Proxy (`./cloud_sql_proxy.exe -instances=PROJECT:REGION:INSTANCE=tcp:5432`)
- [ ] Set `.env` to Cloud SQL connection string and run `npx prisma migrate deploy`
- [ ] Execute `npm run db:seed` against Cloud SQL (Proxy must remain alive)
- [ ] Enable automated backups & PITR in Google Cloud Console

## Phase 4 – Application Integration
- [ ] Replace mock data usage with Prisma queries (`lib/mock-data.ts` -> API endpoints)
- [ ] Build Accounts & Contacts API routes with RBAC filters
- [ ] Wire dynamic table components to `/api/table-preferences/[pageKey]`
- [ ] Implement account & contact detail pages backed by live data
- [ ] Add audit logging middleware on mutations

## Phase 5 – Sign-off
- [ ] Performance test (1k account load, column ops, search latency)
- [ ] RBAC regression (4 roles, export restrictions, copy protection)
- [ ] Update docs: `GoogleCloud_Schema_Set_Up.md`, `DATABASE_SCHEMA_DESIGN.md`
- [ ] Capture acceptance evidence for Milestone 1 payment



