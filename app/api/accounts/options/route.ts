import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { resolveTenantId } from "@/lib/server-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CANONICAL_ACCOUNT_TYPES = [
  { code: "CUSTOMER", name: "Customer", displayOrder: 10 },
  { code: "DISTRIBUTOR", name: "Distributor", displayOrder: 20 },
  { code: "HOUSE_REP", name: "House", displayOrder: 30 },
  { code: "OTHER", name: "Other", displayOrder: 40 },
  { code: "PROSPECT", name: "Prospect", displayOrder: 50 },
  { code: "SUBAGENT", name: "Subagent", displayOrder: 60 },
  { code: "VENDOR", name: "Vendor", displayOrder: 70 }
] as const

const CANONICAL_NORMALIZED_CODES = new Set(
  CANONICAL_ACCOUNT_TYPES.map(entry => normalizeAccountTypeCode(entry.code))
)

const FALLBACK_NORMALIZED_CODE = normalizeAccountTypeCode("OTHER")

function normalizeAccountTypeCode(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase()
}

async function ensureCanonicalAccountTypes(tenantId: string) {
  type AccountTypeWithCount = Awaited<
    ReturnType<typeof prisma.accountType.findMany>
  >[number] & { _count?: { accounts?: number; contacts?: number } }

  const existing: AccountTypeWithCount[] = await prisma.accountType.findMany({
    where: { tenantId },
    include: { _count: { select: { accounts: true, contacts: true } } }
  })

  const groupedByNormalized = new Map<string, AccountTypeWithCount[]>()
  for (const accountType of existing) {
    const normalized = normalizeAccountTypeCode(accountType.code)
    const bucket = groupedByNormalized.get(normalized)
    if (bucket) {
      bucket.push(accountType)
    } else {
      groupedByNormalized.set(normalized, [accountType])
    }
  }

  const canonicalRecords = new Map<string, { id: string }>()

  const usageScore = (accountType: AccountTypeWithCount) =>
    (accountType._count?.accounts ?? 0) + (accountType._count?.contacts ?? 0)

  for (const entry of CANONICAL_ACCOUNT_TYPES) {
    const normalizedCode = normalizeAccountTypeCode(entry.code)
    const duplicates = [...(groupedByNormalized.get(normalizedCode) ?? [])]
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
          isAssignableToContacts: true,
          isActive: true,
          isSystem: true
        }
      })
    } else {
      const needsUpdate =
        primary.code !== entry.code ||
        primary.name !== entry.name ||
        primary.displayOrder !== entry.displayOrder ||
        primary.isAssignableToContacts !== true ||
        primary.isSystem !== true

      primaryRecord = needsUpdate
        ? await prisma.accountType.update({
            where: { id: primary.id },
            data: {
              code: entry.code,
              name: entry.name,
              displayOrder: entry.displayOrder,
              isAssignableToContacts: true,
              isSystem: true
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

    canonicalRecords.set(normalizedCode, primaryRecord)
  }

  // Note: non-canonical account types are no longer deleted here.
  // They are managed via the Data Settings admin UI.
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId(request.nextUrl.searchParams.get("tenantId"))

    await ensureCanonicalAccountTypes(tenantId)

    const [accountTypes, industries, parentAccounts, owners] = await Promise.all([
      prisma.accountType.findMany({
        where: { tenantId, isActive: true },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true }
      }),
      prisma.industry.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      }),
      prisma.account.findMany({
        where: { tenantId },
        orderBy: { accountName: "asc" },
        select: { id: true, accountName: true }
      }),
      prisma.user.findMany({
        where: { tenantId, status: "Active" },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true }
      })
    ])

    return NextResponse.json({
      accountTypes,
      industries,
      parentAccounts,
      owners
    })
  } catch (error) {
    console.error("Failed to load account options", error)
    return NextResponse.json({ error: "Failed to load account options" }, { status: 500 })
  }
}
