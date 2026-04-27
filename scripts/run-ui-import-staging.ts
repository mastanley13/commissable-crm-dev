import path from "node:path"
import { pathToFileURL } from "node:url"

import { NextRequest } from "next/server"
import XLSX from "xlsx"

import { createUserSession } from "../lib/auth"
import { prisma } from "../lib/db"
import {
  getDataImportEntityDefinition,
  type DataImportEntityType
} from "../lib/data-import/catalog"

type RunMode = "validate-only" | "import"

interface ImportResult {
  totalRows: number
  successRows: number
  skippedRows: number
  errorRows: number
  errors: Array<{ rowNumber: number; field: string; errorType: string; message: string }>
  mode?: string
  importJobId?: string
  storedErrorCount?: number
}

interface ImportFileSpec {
  entityType: DataImportEntityType
  fileName: string
  sheetName: string
  upsertExisting?: boolean
  entityOptions?: Record<string, unknown>
}

const IMPORT_BATCH_ROW_LIMIT = 5000
const BASE_DIR = path.join(process.cwd(), "2026-04-17_Import_Test_Data", "UI_Import_Files")

const IMPORT_FILES: ImportFileSpec[] = [
  { entityType: "accounts", fileName: "01_Accounts_UI_Import.xlsx", sheetName: "Accounts", upsertExisting: true },
  { entityType: "contacts", fileName: "02_Contacts_UI_Import.xlsx", sheetName: "Contacts", upsertExisting: true },
  { entityType: "products", fileName: "03_Products_UI_Import.xlsx", sheetName: "Products", upsertExisting: true },
  { entityType: "opportunities", fileName: "04_Opportunities_UI_Import.xlsx", sheetName: "Opportunities", upsertExisting: true },
  {
    entityType: "deposit-transactions",
    fileName: "05_Deposit_Transactions_UI_Sample.xlsx",
    sheetName: "Deposit Transactions",
    upsertExisting: false,
    entityOptions: {
      historicalBucket: "settled-history",
      sourceSystem: "UI Internal Staging Run",
      idempotencyKey: "ui-internal-staging-deposits-2026-04-21-v2",
      defaultDistributorAccountName: "Telarus",
      defaultVendorAccountName: "ACC Business",
      notesPrefix: "Internal staging run 2026-04-21"
    }
  },
  { entityType: "revenue-schedules", fileName: "06_Revenue_Schedules_UI_Import.xlsx", sheetName: "Revenue Schedules", upsertExisting: false }
]

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

function buildAutoMapping(headers: string[], entityType: DataImportEntityType) {
  const definition = getDataImportEntityDefinition(entityType)
  if (!definition) {
    throw new Error(`Missing import definition for ${entityType}`)
  }

  const aliasToField = new Map<string, string>()
  for (const field of definition.fields) {
    for (const key of [field.id, field.label, ...(field.aliases ?? [])]) {
      aliasToField.set(normalizeKey(key), field.id)
    }
  }

  const usedFields = new Set<string>()
  const mapping: Record<string, string> = {}
  for (const header of headers) {
    const fieldId = aliasToField.get(normalizeKey(header))
    if (!fieldId || usedFields.has(fieldId)) {
      continue
    }
    mapping[header] = fieldId
    usedFields.add(fieldId)
  }

  return mapping
}

function readRows(fileName: string, sheetName: string) {
  const workbook = XLSX.readFile(path.join(BASE_DIR, fileName))
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) {
    throw new Error(`${fileName} is missing worksheet ${sheetName}`)
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" })
}

function splitRows<T>(rows: T[]) {
  const batches: T[][] = []
  for (let index = 0; index < rows.length; index += IMPORT_BATCH_ROW_LIMIT) {
    batches.push(rows.slice(index, index + IMPORT_BATCH_ROW_LIMIT))
  }
  return batches
}

async function postImport(sessionToken: string, body: Record<string, unknown>) {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as { POST?: unknown }).POST
  if (typeof POST !== "function") {
    throw new Error("Import route POST handler was not found")
  }

  const response = await POST(
    new NextRequest("http://localhost/api/admin/data-settings/imports", {
      method: "POST",
      headers: {
        cookie: `session-token=${sessionToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    })
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`${response.status}: ${payload?.error ?? "Import request failed"}`)
  }
  return payload.data as ImportResult
}

async function createStagingSession() {
  const admin = await prisma.user.findFirst({
    where: { email: "admin@commissable.test", status: "Active" },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true }
          }
        }
      }
    }
  })

  if (!admin) {
    throw new Error("Active admin@commissable.test user was not found")
  }

  const permissionCodes = new Set(admin.role?.permissions.map(rolePermission => rolePermission.permission.code) ?? [])
  if (!permissionCodes.has("admin.data_settings.manage") && !permissionCodes.has("system.settings.write")) {
    throw new Error("Admin user lacks admin.data_settings.manage/system.settings.write")
  }

  const session = await createUserSession(
    admin.id,
    admin.tenantId,
    "127.0.0.1",
    "internal-ui-import-staging-runner"
  )

  return session.sessionToken
}

export async function runUiImportStaging(mode: RunMode) {
  const sessionToken = await createStagingSession()
  const summary: Array<{
    entityType: DataImportEntityType
    fileName: string
    rows: number
    batches: number
    successRows: number
    skippedRows: number
    errorRows: number
    importJobIds: string[]
    sampleErrors: ImportResult["errors"]
  }> = []

  for (const file of IMPORT_FILES) {
    const rows = readRows(file.fileName, file.sheetName)
    const headers = Object.keys(rows[0] ?? {})
    const mapping = buildAutoMapping(headers, file.entityType)
    const batches = splitRows(rows)
    const aggregate = {
      totalRows: 0,
      successRows: 0,
      skippedRows: 0,
      errorRows: 0,
      errors: [] as ImportResult["errors"],
      importJobIds: [] as string[]
    }

    for (let index = 0; index < batches.length; index += 1) {
      const batchRows = batches[index]
      const batchNumber = index + 1
      const result = await postImport(sessionToken, {
        entityType: file.entityType,
        upsertExisting:
          file.entityType === "deposit-transactions" || file.entityType === "revenue-schedules"
            ? false
            : file.upsertExisting ?? true,
        validateOnly: mode === "validate-only",
        mapping,
        rows: batchRows,
        fileName: batches.length > 1
          ? `${file.fileName} :: ${mode} part ${batchNumber} of ${batches.length}`
          : file.fileName,
        entityOptions:
          file.entityType === "deposit-transactions"
            ? {
                ...(file.entityOptions ?? {}),
                idempotencyKey:
                  batches.length > 1
                    ? `${String(file.entityOptions?.idempotencyKey ?? "ui-staging")}-${mode}-part-${batchNumber}`
                    : `${String(file.entityOptions?.idempotencyKey ?? "ui-staging")}-${mode}`
              }
            : undefined
      })

      aggregate.totalRows += result.totalRows
      aggregate.successRows += result.successRows
      aggregate.skippedRows += result.skippedRows
      aggregate.errorRows += result.errorRows
      if (result.importJobId) {
        aggregate.importJobIds.push(result.importJobId)
      }
      aggregate.errors.push(
        ...result.errors.map(error => ({
          ...error,
          rowNumber: error.rowNumber + index * IMPORT_BATCH_ROW_LIMIT
        }))
      )
    }

    const item = {
      entityType: file.entityType,
      fileName: file.fileName,
      rows: rows.length,
      batches: batches.length,
      successRows: aggregate.successRows,
      skippedRows: aggregate.skippedRows,
      errorRows: aggregate.errorRows,
      importJobIds: aggregate.importJobIds,
      sampleErrors: aggregate.errors.slice(0, 10)
    }

    summary.push(item)
    console.log(JSON.stringify(item, null, 2))

    if (mode === "import" && aggregate.errorRows > 0) {
      throw new Error(`Stopping import sequence after ${file.entityType}; ${aggregate.errorRows} row(s) errored.`)
    }
  }

  return summary
}

async function main() {
  const rawMode = process.argv.includes("--import") ? "import" : "validate-only"
  const summary = await runUiImportStaging(rawMode)
  console.log("UI_IMPORT_STAGING_SUMMARY_JSON=" + JSON.stringify(summary))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch(error => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
