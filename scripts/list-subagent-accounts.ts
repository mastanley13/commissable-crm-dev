/*
  List all accounts with Account Type = Subagent.
  Usage:
    npm run report:subagents            // all tenants
    npm run report:subagents -- --tenant <TENANT_ID>
*/
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function parseArgs() {
  const args = process.argv.slice(2)
  const out: { tenant?: string } = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if ((a === "--tenant" || a === "-t") && i + 1 < args.length) {
      out.tenant = args[i + 1]
      i++
    }
  }
  return out
}

async function main() {
  const { tenant } = parseArgs()

  const where: any = {
    ...(tenant ? { tenantId: tenant } : {}),
    accountType: {
      OR: [
        { name: { equals: "Subagent", mode: "insensitive" } },
        { code: { equals: "SUBAGENT", mode: "insensitive" } },
      ],
    },
  }

  const results = await prisma.account.findMany({
    where,
    orderBy: [{ accountName: "asc" }],
    select: {
      id: true,
      tenantId: true,
      accountName: true,
      accountLegalName: true,
      status: true,
      owner: { select: { id: true, fullName: true } },
      accountType: { select: { id: true, name: true, code: true } },
    },
  })

  if (results.length === 0) {
    console.log("No Subagent accounts found" + (tenant ? ` for tenant ${tenant}` : ""))
    return
  }

  // Group by tenant for clarity when not scoped
  const grouped = new Map<string, typeof results>()
  for (const r of results) {
    const key = r.tenantId
    const arr = grouped.get(key)
    if (arr) arr.push(r)
    else grouped.set(key, [r])
  }

  grouped.forEach((rows, tenantId) => {
    if (!tenant) {
      console.log(`\nTenant: ${tenantId}  (Subagent accounts: ${rows.length})`)
    }
    for (const r of rows) {
      console.log(
        `- ${r.accountName}` +
          (r.accountLegalName && r.accountLegalName !== r.accountName
            ? ` (${r.accountLegalName})`
            : "") +
          ` | Owner: ${r.owner?.fullName ?? "—"} | Type: ${r.accountType?.name ?? ""}`
      )
    }
  })
}

main()
  .catch((err) => {
    console.error("Failed to list Subagent accounts:", err?.message ?? err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
