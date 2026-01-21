import test from "node:test"
import { execFileSync } from "node:child_process"
import assert from "node:assert/strict"

export type IntegrationContext = {
  databaseUrl: string
  sessionToken: string
  tenantId: string
  userId: string
  roleId: string
  distributorAccountId: string
  vendorAccountId: string
}

let migrated = false

export function requireIntegrationEnv() {
  const databaseUrl = process.env.TEST_DATABASE_URL?.trim()
  const runEnabled = (process.env.RUN_INTEGRATION_TESTS ?? "").trim().toLowerCase()
  const shouldRun = ["1", "true", "yes", "y"].includes(runEnabled)

  if (!shouldRun) {
    return { ok: false as const, reason: "Set RUN_INTEGRATION_TESTS=1 to enable integration tests." }
  }

  if (!databaseUrl) {
    return { ok: false as const, reason: "Set TEST_DATABASE_URL to a disposable Postgres database." }
  }

  return { ok: true as const, databaseUrl }
}

export function integrationTest(name: string, fn: (ctx: IntegrationContext) => Promise<void>) {
  test(name, async t => {
    const env = requireIntegrationEnv()
    if (!env.ok) {
      t.skip(env.reason)
      return
    }

    process.env.USE_CLOUD_SQL_CONNECTOR = "false"
    process.env.DATABASE_URL = env.databaseUrl
    process.env.DIRECT_URL = env.databaseUrl

    if (!migrated) {
      migrateDatabase(env.databaseUrl)
      migrated = true
    }

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
    assert.ok(prisma, "Expected prisma export from lib/db")
    await truncateAllTables(prisma)

    const seeded = await seedTenantUserAndAccounts(prisma)
    await fn(seeded)

    const disconnect = (dbModule as any).disconnect ?? (dbModule as any).default?.disconnect
    if (typeof disconnect === "function") {
      await disconnect().catch(() => null)
    } else {
      await prisma.$disconnect().catch(() => null)
    }
  })
}

function migrateDatabase(databaseUrl: string) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx"
  execFileSync(npx, ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, USE_CLOUD_SQL_CONNECTOR: "false" },
  })
}

async function truncateAllTables(prisma: any) {
  // Keep _prisma_migrations so `migrate deploy` doesn't re-run every test file.
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE \"' || r.tablename || '\" CASCADE;';
      END LOOP;
    END $$;
  `)
}

async function seedTenantUserAndAccounts(prisma: any): Promise<IntegrationContext> {
  const tenant = await prisma.tenant.create({
    data: {
      name: "Test Tenant",
      slug: `test-tenant-${Date.now()}`,
    },
    select: { id: true },
  })

  const accountType = await prisma.accountType.create({
    data: {
      tenantId: tenant.id,
      code: "CUSTOMER",
      name: "Customer",
    },
    select: { id: true },
  })

  const distributor = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      accountTypeId: accountType.id,
      accountName: "Test Distributor",
    },
    select: { id: true },
  })

  const vendor = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      accountTypeId: accountType.id,
      accountName: "Test Vendor",
    },
    select: { id: true },
  })

  const [managePerm, viewPerm] = await Promise.all([
    prisma.permission.upsert({
      where: { code: "reconciliation.manage" },
      update: {},
      create: { code: "reconciliation.manage", name: "Reconciliation Manage", category: "Finance" },
      select: { id: true },
    }),
    prisma.permission.upsert({
      where: { code: "reconciliation.view" },
      update: {},
      create: { code: "reconciliation.view", name: "Reconciliation View", category: "Finance" },
      select: { id: true },
    }),
  ])

  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      code: "TEST_RECONCILIATION_MANAGER",
      name: "Test Reconciliation Manager",
      permissions: {
        create: [{ permissionId: managePerm.id }, { permissionId: viewPerm.id }],
      },
    },
    select: { id: true },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      roleId: role.id,
      email: `test-${Date.now()}@example.com`,
      firstName: "Test",
      lastName: "User",
      fullName: "Test User",
      status: "Active",
    },
    select: { id: true },
  })

  const authModule = await import("../lib/auth")
  const createUserSession =
    (authModule as any).createUserSession ?? (authModule as any).default?.createUserSession
  assert.equal(typeof createUserSession, "function", "Expected createUserSession export from lib/auth")
  const session = await createUserSession(user.id, tenant.id, "127.0.0.1", "integration-test")

  assert.ok(session.sessionToken, "Expected seeded session token")

  return {
    databaseUrl: process.env.DATABASE_URL ?? "",
    sessionToken: session.sessionToken,
    tenantId: tenant.id,
    userId: user.id,
    roleId: role.id,
    distributorAccountId: distributor.id,
    vendorAccountId: vendor.id,
  }
}

export async function readJson<T = any>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Expected JSON response, got: ${text.slice(0, 200)}`)
  }
}

export function assertStatus(response: Response, expected: number) {
  assert.equal(response.status, expected)
}
