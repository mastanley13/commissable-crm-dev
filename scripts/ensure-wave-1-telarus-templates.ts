import path from "node:path"
import dotenv from "dotenv"
import { PrismaClient, Prisma } from "@prisma/client"
import { serializeDepositMappingForTemplate } from "@/lib/deposit-import/template-mapping"
import { serializeTelarusTemplateFieldsForTemplate } from "@/lib/deposit-import/telarus-template-fields"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true })

const prisma = new PrismaClient()

const REQUIRED_VENDORS = ["ACC Business", "Advantix", "AT&T", "Bigleaf"] as const
const DISTRIBUTOR_NAME = "Telarus"
const APPLY = process.argv.includes("--apply")

type WaveVendorName = (typeof REQUIRED_VENDORS)[number]

async function resolveTenantId() {
  const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!tenant) throw new Error("No tenant found.")
  return tenant.id
}

async function resolveSystemUserId(tenantId: string) {
  const user = await prisma.user.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!user) throw new Error(`No user found for tenant ${tenantId}.`)
  return user.id
}

async function resolveAccountId(tenantId: string, accountName: string) {
  const exact = await prisma.account.findFirst({
    where: {
      tenantId,
      accountName: { equals: accountName, mode: "insensitive" },
    },
    select: { id: true, accountName: true },
  })
  if (exact) return exact

  const partial = await prisma.account.findMany({
    where: {
      tenantId,
      accountName: { contains: accountName, mode: "insensitive" },
    },
    select: { id: true, accountName: true },
    take: 2,
  })

  if (partial.length === 1) return partial[0]!
  if (partial.length > 1) {
    throw new Error(`Ambiguous account match for ${accountName}`)
  }
  throw new Error(`Account not found: ${accountName}`)
}

async function loadTemplateMatch(vendorName: WaveVendorName) {
  const mod = await import("../lib/deposit-import/telarus-template-master")
  const finder =
    (mod as any).findTelarusTemplateMatch ??
    (mod as any).default?.findTelarusTemplateMatch ??
    (mod as any).default?.default?.findTelarusTemplateMatch
  if (typeof finder !== "function") {
    throw new Error("Could not load findTelarusTemplateMatch from telarus-template-master.ts")
  }
  const match = finder({
    distributorName: DISTRIBUTOR_NAME,
    vendorName,
  }) as
    | {
        templateMapName: string
        templateId: string | null
        mapping: unknown
        templateFields: unknown
      }
    | null

  if (!match) {
    throw new Error(`No Telarus template match found for ${vendorName}`)
  }

  return match
}

function hasTelarusMetadata(config: Prisma.JsonValue | null) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false
  const record = config as Record<string, unknown>
  return Boolean(record.telarusTemplateMapName || record.telarusTemplateFields || record.telarusTemplateId)
}

async function main() {
  const tenantId = await resolveTenantId()
  const createdByUserId = await resolveSystemUserId(tenantId)
  const distributor = await resolveAccountId(tenantId, DISTRIBUTOR_NAME)
  const summary: Array<Record<string, unknown>> = []

  for (const vendorName of REQUIRED_VENDORS) {
    const vendor = await resolveAccountId(tenantId, vendorName)
    const existing = await prisma.reconciliationTemplate.findFirst({
      where: {
        tenantId,
        distributorAccountId: distributor.id,
        vendorAccountId: vendor.id,
      },
      select: {
        id: true,
        name: true,
        config: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    })

    const match = await loadTemplateMatch(vendorName)
    const desiredName = match.templateMapName || `${DISTRIBUTOR_NAME}-${vendorName}`
    const desiredConfig: Prisma.InputJsonValue = {
      ...(serializeDepositMappingForTemplate(match.mapping as any) as unknown as Prisma.JsonObject),
      ...(serializeTelarusTemplateFieldsForTemplate(match.templateFields as any) as unknown as Prisma.JsonObject),
      telarusTemplateId: match.templateId ?? null,
      telarusOrigin: DISTRIBUTOR_NAME,
      telarusCompanyName: vendorName,
      telarusTemplateMapName: desiredName,
    } as Prisma.InputJsonValue

    const action =
      !existing ? "create"
      : hasTelarusMetadata(existing.config) ? "ready"
      : "repair"

    summary.push({
      vendorName,
      existingTemplateId: existing?.id ?? null,
      existingTemplateName: existing?.name ?? null,
      action,
      desiredTemplateName: desiredName,
      telarusTemplateId: match.templateId ?? null,
    })

    if (!APPLY || action === "ready") continue

    if (!existing) {
      await prisma.reconciliationTemplate.create({
        data: {
          tenantId,
          name: desiredName,
          description: "Wave 1 targeted Telarus template seed.",
          distributorAccountId: distributor.id,
          vendorAccountId: vendor.id,
          createdByUserId,
          createdByContactId: null,
          config: desiredConfig,
        },
      })
      continue
    }

    await prisma.reconciliationTemplate.update({
      where: { id: existing.id },
      data: {
        name: existing.name || desiredName,
        config: desiredConfig,
      },
    })
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        tenantId,
        distributor: DISTRIBUTOR_NAME,
        vendors: summary,
      },
      null,
      2
    )
  )
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
