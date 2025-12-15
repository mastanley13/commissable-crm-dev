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
  "Vendor Name": "vendorNameRaw",
  "Customer Account": "accountIdVendor",
  "Vendor - Customer ID": "customerIdVendor",
  "Vendor - Order ID": "orderIdVendor",
  "Vendor - Product Name": "productNameRaw",
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
      })
    }
  }

  return result
}

async function main() {
  const tenant =
    (await prisma.tenant.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })) ?? null

  if (!tenant) {
    console.error("No tenant found; cannot seed Telarus templates.")
    process.exit(1)
  }

  const tenantId = tenant.id
  const telarusRows = loadTelarusCsv()

  const groups = new Map<string, { templateMapName: string; templateId: string; rows: TelarusRow[] }>()

  for (const row of telarusRows) {
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

  for (const [key, group] of groups.entries()) {
    const [origin, companyName] = key.split("|")
    const distributorName = origin.trim()
    const vendorName = companyName.trim()

    if (!distributorName || !vendorName || vendorName === "ALL") continue

    const distributor = await prisma.account.findFirst({
      where: {
        tenantId,
        accountName: { equals: distributorName, mode: "insensitive" },
      },
      select: { id: true },
    })

    const vendor = await prisma.account.findFirst({
      where: {
        tenantId,
        accountName: { equals: vendorName, mode: "insensitive" },
      },
      select: { id: true },
    })

    if (!distributor || !vendor) {
      console.warn(
        `Skipping Telarus template "${group.templateMapName}" – distributor "${distributorName}" or vendor "${vendorName}" not found for tenant ${tenantId}.`,
      )
      continue
    }

    const base = createEmptyDepositMapping()
    const line: Partial<Record<DepositFieldId, string>> = {}

    for (const row of group.rows) {
      const label = row.commissableFieldLabel
      const headerName = row.telarusFieldName
      if (!label || !headerName) continue

      const fieldId = COMMISSABLE_LABEL_TO_DEPOSIT_FIELD_ID[label]
      if (!fieldId || !depositFieldIds.has(fieldId)) continue

      line[fieldId] = headerName
    }

    if (Object.keys(line).length === 0) {
      console.warn(
        `No deposit field mappings derived for Telarus template "${group.templateMapName}" (${distributorName} / ${vendorName}); skipping.`,
      )
      continue
    }

    const mapping: DepositMappingConfigV1 = {
      ...base,
      line,
    }

    const config = serializeDepositMappingForTemplate(mapping)

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
          config: {
            ...config,
            telarusTemplateId: group.templateId || null,
            telarusOrigin: origin,
          } as Prisma.JsonObject,
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
