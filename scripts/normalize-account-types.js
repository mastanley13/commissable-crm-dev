const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const CANONICAL_ACCOUNT_TYPES = [
  { code: "CUSTOMER", name: "Customer", displayOrder: 10 },
  { code: "DISTRIBUTOR", name: "Distributor", displayOrder: 20 },
  { code: "HOUSE_REP", name: "House", displayOrder: 30 },
  { code: "OTHER", name: "Other", displayOrder: 40 },
  { code: "PROSPECT", name: "Prospect", displayOrder: 50 },
  { code: "SUBAGENT", name: "Subagent", displayOrder: 60 },
  { code: "VENDOR", name: "Vendor", displayOrder: 70 }
]

const CANONICAL_NORMALIZED_CODES = new Set(
  CANONICAL_ACCOUNT_TYPES.map(entry => normalizeAccountTypeCode(entry.code))
)

const FALLBACK_NORMALIZED_CODE = normalizeAccountTypeCode("OTHER")

function normalizeAccountTypeCode(value) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase()
}

function usageScore(accountType) {
  return (accountType._count?.accounts ?? 0) + (accountType._count?.contacts ?? 0)
}

async function ensureCanonicalAccountTypesForTenant(tenantId) {
  const existing = await prisma.accountType.findMany({
    where: { tenantId },
    include: { _count: { select: { accounts: true, contacts: true } } }
  })

  const groupedByNormalized = new Map()

  for (const accountType of existing) {
    const normalized = normalizeAccountTypeCode(accountType.code)
    const bucket = groupedByNormalized.get(normalized)
    if (bucket) {
      bucket.push(accountType)
    } else {
      groupedByNormalized.set(normalized, [accountType])
    }
  }

  const canonicalRecords = new Map()

  for (const entry of CANONICAL_ACCOUNT_TYPES) {
    const normalized = normalizeAccountTypeCode(entry.code)
    const duplicates = [...(groupedByNormalized.get(normalized) ?? [])]
    duplicates.sort((a, b) => usageScore(b) - usageScore(a))

    let primary = duplicates[0]
    let primaryRecord

    if (!primary) {
      primaryRecord = await prisma.accountType.create({
        data: {
          tenantId,
          code: entry.code,
          name: entry.name,
          displayOrder: entry.displayOrder,
          isAssignableToContacts: true
        }
      })
    } else {
      const needsUpdate =
        primary.code !== entry.code ||
        primary.name !== entry.name ||
        primary.displayOrder !== entry.displayOrder ||
        primary.isAssignableToContacts !== true

      primaryRecord = needsUpdate
        ? await prisma.accountType.update({
            where: { id: primary.id },
            data: {
              code: entry.code,
              name: entry.name,
              displayOrder: entry.displayOrder,
              isAssignableToContacts: true
            }
          })
        : primary

      for (const duplicate of duplicates.slice(1)) {
        await prisma.account.updateMany({
          where: { accountTypeId: duplicate.id },
          data: { accountTypeId: primaryRecord.id }
        })
        await prisma.contact.updateMany({
          where: { accountTypeId: duplicate.id },
          data: { accountTypeId: primaryRecord.id }
        })
        await prisma.accountType.delete({ where: { id: duplicate.id } })
      }
    }

    canonicalRecords.set(normalized, primaryRecord)
  }

  const fallbackRecord = canonicalRecords.get(FALLBACK_NORMALIZED_CODE)

  const remaining = await prisma.accountType.findMany({
    where: { tenantId },
    select: { id: true, code: true }
  })

  for (const accountType of remaining) {
    const normalized = normalizeAccountTypeCode(accountType.code)
    if (CANONICAL_NORMALIZED_CODES.has(normalized)) {
      continue
    }

    if (fallbackRecord && accountType.id !== fallbackRecord.id) {
      await prisma.account.updateMany({
        where: { accountTypeId: accountType.id },
        data: { accountTypeId: fallbackRecord.id }
      })
      await prisma.contact.updateMany({
        where: { accountTypeId: accountType.id },
        data: { accountTypeId: fallbackRecord.id }
      })
    }

    await prisma.accountType.delete({ where: { id: accountType.id } })
  }
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } })

  for (const tenant of tenants) {
    await ensureCanonicalAccountTypesForTenant(tenant.id)
  }

  const summary = await prisma.accountType.findMany({
    orderBy: [{ tenantId: "asc" }, { displayOrder: "asc" }],
    select: { tenantId: true, code: true, name: true, displayOrder: true }
  })

  console.table(summary)
}

main()
  .catch(error => {
    console.error("Account type normalization failed", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
