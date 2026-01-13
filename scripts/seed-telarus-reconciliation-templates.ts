import fs from "fs"
import path from "path"
import Papa from "papaparse"
import { PrismaClient, Prisma } from "@prisma/client"
import { depositFieldDefinitions } from "@/lib/deposit-import/fields"
import {
  createEmptyDepositMapping,
  serializeDepositMappingForTemplate,
  type DepositFieldId,
  type DepositMappingConfigV1,
} from "@/lib/deposit-import/template-mapping"
import {
  serializeTelarusTemplateFieldsForTemplate,
  type TelarusTemplateFieldV1,
  type TelarusTemplateFieldsV1,
} from "@/lib/deposit-import/telarus-template-fields"

const prisma = new PrismaClient()

interface TelarusRow {
  templateMapName: string
  origin: string
  companyName: string
  templateId: string
  commissionType: string
  fieldId: string
  telarusFieldName: string
  commissableFieldLabel: string
  block: "common" | "template"
}

// Mapping from high-value Commissable labels in the Telarus CSV
// to our deposit field IDs. This list can be expanded over time as needed.
const COMMISSABLE_LABEL_TO_DEPOSIT_FIELD_ID: Partial<Record<string, DepositFieldId>> = {
  // Usage / quantity
  "Actual Usage - Gross": "usage",
  "Actual Usage": "usage",

  // Commission amounts / rates
  "Actual Commission": "commission",
  "Actual Commission Rate %": "commissionRate",

  // Account identity
  "Account Legal Name": "accountNameRaw",
  "Company Name": "accountNameRaw",

  // Vendor / customer identifiers
  "Vendor - Account ID": "accountIdVendor",
  "Other - Account ID": "accountIdVendor",
  "Vendor Name": "vendorNameRaw",
  "Customer Account": "accountIdVendor",
  "Vendor - Customer ID": "customerIdVendor",
  "Other - Customer ID": "customerIdVendor",
  "Vendor - Order ID": "orderIdVendor",
  "Other - Order ID": "orderIdVendor",
  "Vendor - Product Name": "productNameRaw",
  "Other - Product Name": "productNameRaw",
  "Vendor - Part Number": "partNumberRaw",
  "Other - Part Number": "partNumberRaw",
  "Vendor - Location  ID": "locationId",

  // Dates that should behave like payment dates at the line level.
  // (If a vendor-specific template uses "Payment Date" as the line date,
  // we treat it as our Payment Date field.)
  "Payment Date": "paymentDate",
}

function loadTelarusCsv(): TelarusRow[] {
  const csvPath = path.join(process.cwd(), "docs", "reference-data", "telarus-vendor-map-fields-master.csv")
  const text = fs.readFileSync(csvPath, "utf8")
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" })

  const rows = parsed.data as string[][]
  const result: TelarusRow[] = []

  let inCommonBlock = false
  let inTemplateBlock = false

  for (const row of rows) {
    if (!row || row.length < 4) continue
    const [col0, col1, col2, col3, col4, col5, col6, col7] = row.map(cell => (cell ?? "").trim())

    if (col0 === "Template Map Name" && col6 === "Telarus CommonFields") {
      inCommonBlock = true
      inTemplateBlock = false
      continue
    }

    if (col0 === "Template Map Name" && col6 === "Telarus fieldName") {
      inCommonBlock = false
      inTemplateBlock = true
      continue
    }

    if (!col0 && !col1 && !col2) continue

    if (inCommonBlock) {
      // Common fields are global across templates; we treat them as rows with Template Map Name "ALL".
      result.push({
        templateMapName: col0 || "ALL",
        origin: col1 || "Telarus",
        companyName: col2 || "ALL",
        templateId: col3 || "ALL",
        commissionType: col4,
        fieldId: col5,
        telarusFieldName: col6,
        commissableFieldLabel: col7,
        block: "common",
      })
      continue
    }

    if (inTemplateBlock) {
      result.push({
        templateMapName: col0,
        origin: col1,
        companyName: col2,
        templateId: col3,
        commissionType: col4,
        fieldId: col5,
        telarusFieldName: col6,
        commissableFieldLabel: col7,
        block: "template",
      })
    }
  }

  return result
}

async function main() {
  const tenantIdOverride = process.env.TENANT_ID?.trim()
  const tenantSlugOverride = process.env.TENANT_SLUG?.trim()

  const tenant =
    (tenantIdOverride
      ? await prisma.tenant.findFirst({ where: { id: tenantIdOverride }, select: { id: true } })
      : tenantSlugOverride
        ? await prisma.tenant.findFirst({ where: { slug: tenantSlugOverride }, select: { id: true } })
        : await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } })) ?? null

  if (!tenant) {
    console.error("No tenant found; cannot seed Telarus templates.")
    process.exit(1)
  }

  const tenantId = tenant.id
  const telarusRows = loadTelarusCsv()

  const groups = new Map<string, { templateMapName: string; templateId: string; rows: TelarusRow[] }>()
  const commonRowsByOrigin = new Map<string, TelarusRow[]>()

  for (const row of telarusRows) {
    if (row.block === "common") {
      const originKey = (row.origin || "Telarus").trim().toLowerCase() || "telarus"
      const existing = commonRowsByOrigin.get(originKey) ?? []
      existing.push(row)
      commonRowsByOrigin.set(originKey, existing)
      continue
    }

    const key = `${row.origin || "Telarus"}|${row.companyName || "ALL"}`
    const existing = groups.get(key)
    if (existing) {
      existing.rows.push(row)
    } else {
      groups.set(key, {
        templateMapName: row.templateMapName || `${row.origin}-${row.companyName}`,
        templateId: row.templateId || "",
        rows: [row],
      })
    }
  }

  const depositFieldIds = new Set<DepositFieldId>(depositFieldDefinitions.map(field => field.id as DepositFieldId))

  const resolveAccountByName = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return null

    const exact =
      (await prisma.account.findFirst({
        where: { tenantId, accountName: { equals: trimmed, mode: "insensitive" } },
        select: { id: true, accountName: true },
      })) ?? null

    if (exact) return exact

    const partial = await prisma.account.findMany({
      where: { tenantId, accountName: { contains: trimmed, mode: "insensitive" } },
      select: { id: true, accountName: true },
      take: 2,
    })

    if (partial.length === 1) {
      console.warn(`Using partial account name match for "${trimmed}" -> "${partial[0]!.accountName}"`)
      return partial[0]!
    }

    if (partial.length > 1) {
      console.warn(`Ambiguous account name match for "${trimmed}" (multiple contains matches).`)
    }

    return null
  }

  for (const [key, group] of Array.from(groups.entries())) {
    const [origin, companyName] = key.split("|")
    const distributorName = origin.trim()
    const vendorName = companyName.trim()

    if (!distributorName || !vendorName || vendorName === "ALL") continue

    const commonRows = commonRowsByOrigin.get(distributorName.toLowerCase()) ?? []
    const rowsToApply = commonRows.length > 0 ? [...commonRows, ...group.rows] : group.rows

    const distributor = await resolveAccountByName(distributorName)
    const vendor = await resolveAccountByName(vendorName)

    if (!distributor || !vendor) {
      console.warn(
        `Skipping Telarus template "${group.templateMapName}" – distributor "${distributorName}" or vendor "${vendorName}" not found for tenant ${tenantId}.`,
      )
      continue
    }

    const base = createEmptyDepositMapping()
    const line: Partial<Record<DepositFieldId, string>> = {}

    for (const row of rowsToApply) {
      const label = row.commissableFieldLabel
      const headerName = row.telarusFieldName
      if (!label || !headerName) continue

      const fieldId = COMMISSABLE_LABEL_TO_DEPOSIT_FIELD_ID[label]
      if (!fieldId || !depositFieldIds.has(fieldId)) continue

      line[fieldId] = headerName
    }

    const mapping: DepositMappingConfigV1 = {
      ...base,
      line,
    }

    const templateFieldsByHeader = new Map<string, TelarusTemplateFieldV1>()
    for (const row of rowsToApply) {
      const label = row.commissableFieldLabel
      const headerName = row.telarusFieldName
      if (!label || !headerName) continue
      if (templateFieldsByHeader.has(headerName)) continue
      templateFieldsByHeader.set(headerName, {
        telarusFieldName: headerName,
        commissableFieldLabel: label,
        fieldId: row.fieldId || null,
        commissionType: row.commissionType || null,
        block: row.block,
      })
    }

    const telarusTemplateFields: TelarusTemplateFieldsV1 = {
      version: 1,
      templateMapName: group.templateMapName,
      origin,
      companyName,
      templateId: group.templateId || null,
      fields: Array.from(templateFieldsByHeader.values()),
    }

    if (Object.keys(mapping.line).length === 0 && telarusTemplateFields.fields.length === 0) {
      console.warn(
        `No deposit field mappings derived for Telarus template "${group.templateMapName}" (${distributorName} / ${vendorName}); skipping.`,
      )
      continue
    }

    const config: Prisma.InputJsonValue = {
      ...(serializeDepositMappingForTemplate(mapping) as unknown as Prisma.JsonObject),
      ...(serializeTelarusTemplateFieldsForTemplate(telarusTemplateFields) as unknown as Prisma.JsonObject),
      telarusTemplateId: group.templateId || null,
      telarusOrigin: origin,
      telarusCompanyName: companyName,
      telarusTemplateMapName: group.templateMapName,
    } as unknown as Prisma.InputJsonValue

    const existingTemplate = await prisma.reconciliationTemplate.findFirst({
      where: {
        tenantId,
        distributorAccountId: distributor.id,
        vendorAccountId: vendor.id,
      },
      select: { id: true },
    })

    if (existingTemplate) {
      await prisma.reconciliationTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          config,
        },
      })
      console.log(
        `Updated existing reconciliation template for ${distributorName} / ${vendorName} with Telarus mappings (${group.templateMapName}).`,
      )
    } else {
      await prisma.reconciliationTemplate.create({
        data: {
          tenantId,
          name: group.templateMapName || `${distributorName} - ${vendorName}`,
          description: "Seeded from Telarus vendor map fields master CSV.",
          distributorAccountId: distributor.id,
          vendorAccountId: vendor.id,
          createdByUserId: await resolveSystemUserId(tenantId),
          createdByContactId: null,
          config: config as unknown as Prisma.JsonObject,
        },
      })
      console.log(
        `Created reconciliation template for ${distributorName} / ${vendorName} from Telarus mappings (${group.templateMapName}).`,
      )
    }
  }
}

async function resolveSystemUserId(tenantId: string): Promise<string> {
  const existingUser =
    (await prisma.user.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })) ?? null

  if (!existingUser) {
    throw new Error(`No user found for tenant ${tenantId}; cannot assign createdByUserId for templates.`)
  }

  return existingUser.id
}

main()
  .catch(error => {
    console.error("Failed to seed Telarus reconciliation templates", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
