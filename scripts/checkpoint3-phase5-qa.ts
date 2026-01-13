import fs from "fs/promises"
import path from "path"
import { PrismaClient } from "@prisma/client"
import { parseSpreadsheetFile } from "@/lib/deposit-import/parse-file"
import { seedDepositMapping, type DepositFieldId } from "@/lib/deposit-import/template-mapping"
import { matchDepositLine } from "@/lib/matching/deposit-matcher"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"
import { getUserReconciliationConfidencePreferences } from "@/lib/matching/user-confidence-settings"

const prisma = new PrismaClient()

type QaFileResult = {
  filePath: string
  vendorName: string | null
  distributorName: string | null
  mappedColumns: Partial<Record<DepositFieldId, string>>
  rows: number
  imported?: {
    depositId: string
    lineCount: number
    vendorAccountId: string
    distributorAccountId: string
  }
  matching?: {
    sampled: number
    withCandidates: number
    aboveSuggested70: number
    aboveAuto95: number
    examples: Array<{
      lineId: string
      lineNumber: number | null
      usage: number
      commission: number
      partNumberRaw: string | null
      topCandidate: { scheduleId: string; scheduleName: string; confidence: number } | null
    }>
  }
}

function parseFlag(args: string[], name: string) {
  return args.includes(name)
}

function parseArgValue(args: string[], name: string) {
  const index = args.indexOf(name)
  if (index === -1) return null
  const value = args[index + 1]
  return value && !value.startsWith("--") ? value : null
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function parseDateValue(value: string | null | undefined, fallback?: Date) {
  if (!value) return fallback ?? null
  const trimmed = value.trim()
  if (!trimmed) return fallback ?? null

  const numeric = Number(trimmed)
  if (!Number.isNaN(numeric) && numeric > 20000 && numeric < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    return new Date(excelEpoch.getTime() + numeric * 24 * 60 * 60 * 1000)
  }

  // Prefer ISO-ish dates if present.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? fallback ?? null : parsed
  }

  // Handle US-style mm/dd/yyyy safely.
  const mdY = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdY) {
    const month = Number(mdY[1])
    const day = Number(mdY[2])
    const year = Number(mdY[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day))
    }
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? fallback ?? null : parsed
}

function normalizeNumber(value: string | undefined) {
  if (value === undefined || value === null) {
    return null
  }
  const normalized = value.replace(/[^0-9.\-]/g, "")
  if (!normalized) return null
  const numeric = Number(normalized)
  if (Number.isNaN(numeric)) return null
  return numeric
}

function pickFirstNonEmptyColumnValue(rows: string[][], columnIndex: number | null) {
  if (columnIndex === null || columnIndex === undefined) return null
  for (const row of rows) {
    const value = row[columnIndex]
    if (value && value.trim()) return value.trim()
  }
  return null
}

async function main() {
  const args = process.argv.slice(2)
  const apply = parseFlag(args, "--apply")
  const maxLines = Number(parseArgValue(args, "--max-lines") ?? "50")
  const matchSample = Number(parseArgValue(args, "--match-sample") ?? "15")

  const flagsWithValues = new Set(["--max-lines", "--match-sample"])
  const fileArgs: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (flagsWithValues.has(arg)) {
      index += 1
      continue
    }
    if (arg === "--apply") continue
    if (arg.startsWith("--")) continue
    fileArgs.push(arg)
  }
  const files =
    fileArgs.length > 0
      ? fileArgs
      : [
          "Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet1.csv",
          "Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet2.csv",
        ]

  const tenant =
    (process.env.QA_TENANT_ID
      ? await prisma.tenant.findFirst({ where: { id: process.env.QA_TENANT_ID }, select: { id: true } })
      : await prisma.tenant.findFirst({ select: { id: true } })) ?? null

  if (!tenant) {
    throw new Error("No tenant found in DB. Ensure you are connected to a populated environment.")
  }

  const user =
    (process.env.QA_USER_ID
      ? await prisma.user.findFirst({
          where: { id: process.env.QA_USER_ID, tenantId: tenant.id },
          select: { id: true, email: true },
        })
      : await prisma.user.findFirst({
          where: { tenantId: tenant.id },
          select: { id: true, email: true },
        })) ?? null

  if (!user) {
    throw new Error("No user found for the selected tenant. Set QA_USER_ID or create a user.")
  }

  const tenantPrefs = await getTenantMatchingPreferences(tenant.id)
  const userPrefs = await getUserReconciliationConfidencePreferences(tenant.id, user.id)

  console.log("Checkpoint 3 Phase 5 QA")
  console.log("- tenantId:", tenant.id)
  console.log("- userId:", user.id, user.email ? `(${user.email})` : "")
  console.log("- apply:", apply)
  console.log("- engineMode:", tenantPrefs.engineMode)
  console.log("- varianceTolerance:", tenantPrefs.varianceTolerance)
  console.log("- includeFutureSchedulesDefault:", tenantPrefs.includeFutureSchedulesDefault)
  console.log("- suggestedMinConfidence:", userPrefs.suggestedMatchesMinConfidence)
  console.log("- autoMatchMinConfidence:", userPrefs.autoMatchMinConfidence)
  console.log("")

  const results: QaFileResult[] = []

  for (const filePath of files) {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
    const buffer = await fs.readFile(absolutePath)
    const parsed = await parseSpreadsheetFile(new Blob([buffer]), path.basename(filePath), "text/csv")

    const seeded = seedDepositMapping({ headers: parsed.headers, templateMapping: null })
    const mappedColumns: Partial<Record<DepositFieldId, string>> = { ...seeded.line }

    // Vendor naming conventions vary widely; try to detect the common Telarus export headers.
    const vendorHeader = mappedColumns.vendorNameRaw ?? (parsed.headers.includes("Supplier Name") ? "Supplier Name" : null)
    const distributorHeader =
      mappedColumns.distributorNameRaw ??
      (parsed.headers.includes("Acquired Master Agency Name") ? "Acquired Master Agency Name" : null)
    const paymentHeader =
      mappedColumns.paymentDate ??
      (parsed.headers.includes("Commission Payment Date") ? "Commission Payment Date" : null)

    const vendorColumnIndex = vendorHeader ? parsed.headers.findIndex(h => h === vendorHeader) : -1
    const distributorColumnIndex = distributorHeader ? parsed.headers.findIndex(h => h === distributorHeader) : -1
    const paymentColumnIndex = paymentHeader ? parsed.headers.findIndex(h => h === paymentHeader) : -1

    const vendorName = pickFirstNonEmptyColumnValue(parsed.rows, vendorColumnIndex === -1 ? null : vendorColumnIndex)
    const distributorName = pickFirstNonEmptyColumnValue(parsed.rows, distributorColumnIndex === -1 ? null : distributorColumnIndex)
    const paymentDateRaw = pickFirstNonEmptyColumnValue(parsed.rows, paymentColumnIndex === -1 ? null : paymentColumnIndex)

    const depositDate = parseDateValue(paymentDateRaw, new Date()) ?? new Date()

    const result: QaFileResult = {
      filePath,
      vendorName,
      distributorName,
      mappedColumns,
      rows: parsed.rows.length,
    }

    console.log(`File: ${filePath}`)
    console.log(`- rows: ${parsed.rows.length}`)
    console.log(`- vendorName (detected): ${vendorName ?? "UNKNOWN"}`)
    console.log(`- distributorName (detected): ${distributorName ?? "UNKNOWN"}`)
    console.log(`- auto-mapped usage column: ${mappedColumns.usage ?? "NONE"}`)
    console.log(`- auto-mapped commission column: ${mappedColumns.commission ?? "NONE"}`)
    console.log(`- auto-mapped partNumberRaw column: ${mappedColumns.partNumberRaw ?? "NONE"}`)
    console.log(`- auto-mapped paymentDate column: ${mappedColumns.paymentDate ?? "NONE"}`)
    console.log("")

    const vendorAccount =
      vendorName
        ? await prisma.account.findFirst({
            where: { tenantId: tenant.id, accountName: vendorName },
            select: { id: true, accountName: true },
          })
        : null

    const distributorAccount =
      distributorName
        ? await prisma.account.findFirst({
            where: { tenantId: tenant.id, accountName: distributorName },
            select: { id: true, accountName: true },
          })
        : null

    if (!vendorAccount || !distributorAccount) {
      console.log("Skipping DB import (missing accounts):")
      console.log("- vendorAccount:", vendorAccount ? `${vendorAccount.accountName} (${vendorAccount.id})` : "NOT FOUND")
      console.log(
        "- distributorAccount:",
        distributorAccount ? `${distributorAccount.accountName} (${distributorAccount.id})` : "NOT FOUND",
      )
      if (!vendorAccount && vendorName) {
        const suggestions = await prisma.account.findMany({
          where: { tenantId: tenant.id, accountName: { contains: vendorName, mode: "insensitive" } },
          select: { id: true, accountName: true },
          orderBy: { accountName: "asc" },
          take: 5,
        })
        if (suggestions.length) {
          console.log("- vendorAccount suggestions:", suggestions.map(row => `${row.accountName} (${row.id})`).join(", "))
        }
      }
      if (!distributorAccount && distributorName) {
        const suggestions = await prisma.account.findMany({
          where: { tenantId: tenant.id, accountName: { contains: distributorName, mode: "insensitive" } },
          select: { id: true, accountName: true },
          orderBy: { accountName: "asc" },
          take: 5,
        })
        if (suggestions.length) {
          console.log("- distributorAccount suggestions:", suggestions.map(row => `${row.accountName} (${row.id})`).join(", "))
        }
      }
      console.log("")
      results.push(result)
      continue
    }

    if (!apply) {
      console.log("Dry-run mode: not creating Deposit/DepositLineItems in DB.")
      console.log("")
      results.push(result)
      continue
    }

    const mappingForImport: Record<string, string> = Object.fromEntries(
      Object.entries(mappedColumns).filter(([, column]) => typeof column === "string" && column.length > 0),
    )

    const headers = parsed.headers
    const columnIndex: Record<string, number> = {}
    for (const [fieldId, columnName] of Object.entries(mappingForImport)) {
      const index = headers.findIndex(header => header === columnName)
      if (index === -1) continue
      columnIndex[fieldId] = index
    }

    const resolveString = (row: string[], fieldId: DepositFieldId) => {
      const index = columnIndex[fieldId]
      if (index === undefined) return null
      const value = row[index]
      const trimmed = value?.trim()
      return trimmed ? trimmed : null
    }

    const usageIndex = columnIndex.usage
    const commissionIndex = columnIndex.commission

    if (usageIndex === undefined || commissionIndex === undefined) {
      console.log("Skipping DB import (usage/commission not mapped).")
      console.log("")
      results.push(result)
      continue
    }

    const lineItemsData = parsed.rows
      .slice(0, Math.max(0, maxLines))
      .map((row, index) => {
        const usageValue = normalizeNumber(row[usageIndex])
        const commissionValue = normalizeNumber(row[commissionIndex])
        if (usageValue === null && commissionValue === null) {
          return null
        }

        return {
          tenantId: tenant.id,
          depositId: "",
          lineNumber: index + 1,
          paymentDate: parseDateValue(resolveString(row, "paymentDate"), depositDate) ?? depositDate,
          accountNameRaw:
            resolveString(row, "accountNameRaw") ??
            (headers.includes("Customer Business Name") ? row[headers.findIndex(h => h === "Customer Business Name")]?.trim() || null : null),
          accountIdVendor: resolveString(row, "accountIdVendor"),
          customerIdVendor: resolveString(row, "customerIdVendor"),
          orderIdVendor: resolveString(row, "orderIdVendor"),
          productNameRaw: resolveString(row, "productNameRaw"),
          partNumberRaw: resolveString(row, "partNumberRaw"),
          vendorNameRaw: resolveString(row, "vendorNameRaw"),
          distributorNameRaw: resolveString(row, "distributorNameRaw"),
          locationId: resolveString(row, "locationId"),
          customerPurchaseOrder: resolveString(row, "customerPurchaseOrder"),
          usage: usageValue,
          usageAllocated: 0,
          usageUnallocated: usageValue ?? 0,
          commission: commissionValue,
          commissionAllocated: 0,
          commissionUnallocated: commissionValue ?? 0,
          commissionRate: normalizeNumber(resolveString(row, "commissionRate") ?? undefined),
          vendorAccountId: vendorAccount.id,
        }
      })
      .filter(Boolean) as Array<Record<string, unknown>>

    if (!lineItemsData.length) {
      console.log("Skipping DB import (no usable rows after parsing).")
      console.log("")
      results.push(result)
      continue
    }

    const qaDepositName = `QA ${vendorAccount.accountName} - ${path.basename(filePath)}`

    const deposit = await prisma.$transaction(async tx => {
      const existing = await tx.deposit.findFirst({
        where: {
          tenantId: tenant.id,
          distributorAccountId: distributorAccount.id,
          vendorAccountId: vendorAccount.id,
          depositName: qaDepositName,
          month: startOfMonth(depositDate),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, totalItems: true },
      })

      if (existing && Number(existing.totalItems ?? 0) > 0) {
        return { id: existing.id, lineCount: Number(existing.totalItems ?? 0) }
      }

      const createdDeposit = await tx.deposit.create({
        data: {
          tenantId: tenant.id,
          accountId: distributorAccount.id,
          month: startOfMonth(depositDate),
          depositName: qaDepositName,
          paymentDate: depositDate,
          distributorAccountId: distributorAccount.id,
          vendorAccountId: vendorAccount.id,
          createdByUserId: user.id,
        },
        select: { id: true },
      })

      const depositId = createdDeposit.id
      const lineRows = lineItemsData.map(row => ({ ...row, depositId }))

      await tx.depositLineItem.createMany({ data: lineRows as any[] })

      const totalUsage = lineRows.reduce((acc, row) => acc + Number(row.usage ?? 0), 0)
      const totalCommission = lineRows.reduce((acc, row) => acc + Number(row.commission ?? 0), 0)

      await tx.deposit.update({
        where: { id: depositId },
        data: {
          totalItems: lineRows.length,
          itemsUnreconciled: lineRows.length,
          totalUsage,
          usageAllocated: 0,
          usageUnallocated: totalUsage,
          totalCommissions: totalCommission,
          commissionAllocated: 0,
          commissionUnallocated: totalCommission,
        },
        select: { id: true },
      })

      return { id: depositId, lineCount: lineRows.length }
    })

    result.imported = {
      depositId: deposit.id,
      lineCount: deposit.lineCount,
      vendorAccountId: vendorAccount.id,
      distributorAccountId: distributorAccount.id,
    }

    const lineItems = await prisma.depositLineItem.findMany({
      where: { tenantId: tenant.id, depositId: deposit.id },
      select: {
        id: true,
        lineNumber: true,
        usage: true,
        commission: true,
        partNumberRaw: true,
      },
      orderBy: { lineNumber: "asc" },
      take: Math.max(0, matchSample),
    })

    let withCandidates = 0
    let aboveSuggested70 = 0
    let aboveAuto95 = 0

    const examples: QaFileResult["matching"]["examples"] = []

    for (const line of lineItems) {
      const usage = Number(line.usage ?? 0)
      const commission = Number(line.commission ?? 0)
      let top: { scheduleId: string; scheduleName: string; confidence: number } | null = null
      try {
        const match = await matchDepositLine(line.id, {
          limit: 1,
          useHierarchicalMatching: tenantPrefs.engineMode === "legacy" ? false : true,
          includeFutureSchedules: tenantPrefs.includeFutureSchedulesDefault,
          varianceTolerance: tenantPrefs.varianceTolerance,
        })
        const candidate = match.candidates[0]
        if (candidate) {
          withCandidates += 1
          top = {
            scheduleId: candidate.revenueScheduleId,
            scheduleName: candidate.revenueScheduleName,
            confidence: candidate.matchConfidence,
          }
          if (candidate.matchConfidence >= 0.7) aboveSuggested70 += 1
          if (candidate.matchConfidence >= 0.95) aboveAuto95 += 1
        }
      } catch {
        // Ignore per-line failures; they show up as missing candidates.
      }

      examples.push({
        lineId: line.id,
        lineNumber: line.lineNumber ?? null,
        usage,
        commission,
        partNumberRaw: line.partNumberRaw ?? null,
        topCandidate: top,
      })
    }

    result.matching = {
      sampled: lineItems.length,
      withCandidates,
      aboveSuggested70,
      aboveAuto95,
      examples,
    }

    console.log("Imported deposit:")
    console.log("- depositId:", deposit.id)
    console.log("- lineCount:", deposit.lineCount)
    console.log("Matching sample:")
    console.log("- sampled:", lineItems.length)
    console.log("- withCandidates:", withCandidates)
    console.log("- >= 0.70:", aboveSuggested70)
    console.log("- >= 0.95:", aboveAuto95)
    console.log("")

    results.push(result)
  }

  console.log("QA run complete.")
  console.log("Tip: run with --apply to create deposits; adjust sampling with --max-lines / --match-sample.")
  console.log("")

  await prisma.$disconnect()
}

main().catch(async error => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
