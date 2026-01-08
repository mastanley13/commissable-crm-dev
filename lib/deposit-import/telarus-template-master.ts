import fs from "fs"
import path from "path"
import Papa from "papaparse"
import { depositFieldDefinitions } from "./fields"
import {
  createEmptyDepositMapping,
  type DepositFieldId,
  type DepositMappingConfigV1,
} from "./template-mapping"

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

interface TelarusGroup {
  templateMapName: string
  origin: string
  companyName: string
  templateId: string
  rows: TelarusRow[]
  originKey: string
  companyKey: string
}

export interface TelarusTemplateMatch {
  templateMapName: string
  origin: string
  companyName: string
  templateId: string | null
  mapping: DepositMappingConfigV1
}

const TELARUS_MASTER_CSV_PATH = path.join(
  process.cwd(),
  "docs",
  "reference-data",
  "telarus-vendor-map-fields-master.csv",
)

// Mapping from high-value Commissable labels in the Telarus CSV to our deposit field IDs.
// Keep in sync with the canonical deposit fields in `lib/deposit-import/fields.ts`.
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

  // Dates
  "Payment Date": "paymentDate",
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function scoreCandidate(needle: string, haystack: string) {
  if (!needle || !haystack) return 0
  if (needle === haystack) return 1000

  if (haystack.startsWith(needle)) return 900 - Math.min(haystack.length - needle.length, 50)
  if (needle.startsWith(haystack)) return 880 - Math.min(needle.length - haystack.length, 50)

  if (haystack.includes(needle)) return 800 - Math.min(haystack.length - needle.length, 80)
  if (needle.includes(haystack)) return 780 - Math.min(needle.length - haystack.length, 80)

  const needleTokens = new Set(needle.split(" ").filter(Boolean))
  const haystackTokens = new Set(haystack.split(" ").filter(Boolean))
  if (needleTokens.size === 0 || haystackTokens.size === 0) return 0

  let overlap = 0
  for (const token of needleTokens) {
    if (haystackTokens.has(token)) overlap += 1
  }
  const ratio = overlap / Math.max(needleTokens.size, haystackTokens.size)
  if (ratio < 0.6) return 0

  return 700 + overlap
}

let cachedIndex:
  | {
      groups: TelarusGroup[]
      commonByOriginKey: Map<string, TelarusRow[]>
    }
  | null = null

function loadTelarusIndex() {
  if (cachedIndex) return cachedIndex

  const text = fs.readFileSync(TELARUS_MASTER_CSV_PATH, "utf8")
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

  const commonByOriginKey = new Map<string, TelarusRow[]>()
  const groupsByKey = new Map<string, TelarusGroup>()

  for (const row of result) {
    const originKey = normalizeKey(row.origin || "Telarus") || "telarus"

    if (row.block === "common") {
      const existing = commonByOriginKey.get(originKey) ?? []
      existing.push(row)
      commonByOriginKey.set(originKey, existing)
      continue
    }

    const companyKey = normalizeKey(row.companyName || "ALL")
    const key = `${originKey}|${companyKey}`
    const existing = groupsByKey.get(key)
    if (existing) {
      existing.rows.push(row)
      continue
    }

    groupsByKey.set(key, {
      templateMapName: row.templateMapName || `${row.origin}-${row.companyName}`,
      origin: row.origin || "Telarus",
      companyName: row.companyName || "",
      templateId: row.templateId || "",
      rows: [row],
      originKey,
      companyKey,
    })
  }

  cachedIndex = {
    groups: Array.from(groupsByKey.values()),
    commonByOriginKey,
  }

  return cachedIndex
}

function addProductColumnHeuristic(mapping: DepositMappingConfigV1, headerName: string, label: string) {
  const normalized = normalizeKey(label)
  if (!normalized.startsWith("vendor")) return
  if (!(normalized.includes("product") || normalized.includes("part number") || normalized.includes("sku"))) return
  mapping.columns[headerName] = { mode: "product" }
}

export function findTelarusTemplateMatch(params: {
  distributorName: string
  vendorName: string
}): TelarusTemplateMatch | null {
  const index = loadTelarusIndex()
  const distributorKey = normalizeKey(params.distributorName)
  const vendorKey = normalizeKey(params.vendorName)

  if (!distributorKey || !vendorKey) return null

  const originCandidates = index.groups.filter(group => {
    if (group.originKey === distributorKey) return true
    if (distributorKey.includes(group.originKey)) return true
    if (group.originKey.includes(distributorKey)) return true
    return false
  })

  if (originCandidates.length === 0) return null

  const scored = originCandidates
    .map(group => ({ group, score: scoreCandidate(vendorKey, group.companyKey) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best) return null

  const second = scored[1]
  if (second && second.score === best.score) {
    return null
  }

  const base = createEmptyDepositMapping()
  const depositFieldIds = new Set<DepositFieldId>(
    depositFieldDefinitions.map(field => field.id as DepositFieldId),
  )

  const commonRows = index.commonByOriginKey.get(best.group.originKey) ?? []
  const rowsToApply = commonRows.length > 0 ? [...commonRows, ...best.group.rows] : best.group.rows

  const mapping: DepositMappingConfigV1 = {
    ...base,
    line: { ...base.line },
    columns: { ...base.columns },
    customFields: { ...base.customFields },
  }

  for (const row of rowsToApply) {
    const label = row.commissableFieldLabel
    const headerName = row.telarusFieldName
    if (!label || !headerName) continue

    const fieldId = COMMISSABLE_LABEL_TO_DEPOSIT_FIELD_ID[label]
    if (fieldId && depositFieldIds.has(fieldId)) {
      mapping.line[fieldId] = headerName
      continue
    }

    addProductColumnHeuristic(mapping, headerName, label)
  }

  if (Object.keys(mapping.line).length === 0 && Object.keys(mapping.columns).length === 0) {
    return null
  }

  return {
    templateMapName: best.group.templateMapName,
    origin: best.group.origin,
    companyName: best.group.companyName,
    templateId: best.group.templateId || null,
    mapping,
  }
}

