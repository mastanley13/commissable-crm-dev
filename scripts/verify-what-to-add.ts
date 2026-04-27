import path from "node:path"
import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client"

import {
  DISTRIBUTOR_NAME,
  allCatalogRows,
  doNotAddPlanRows,
  opportunityPlanRows,
} from "./what-to-add-plan"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true })

const prisma = new PrismaClient()

type VerificationStatus = "present" | "partial" | "missing"

type VerificationRow = {
  rowNumber: number
  actionType: string
  status: VerificationStatus
  details: string
}

type NumericLike = number | string | { toString(): string } | null

function toMoney(value: number) {
  return value.toFixed(2)
}

function approximatelyEqual(left: NumericLike, right: number, tolerance = 0.011) {
  if (left == null) return false
  return Math.abs(Number(left.toString()) - right) < tolerance
}

async function getTenantId() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } })
  if (!tenant) throw new Error("No tenant found.")
  return tenant.id
}

async function verifyCatalogRow(tenantId: string, row: (typeof allCatalogRows)[number]): Promise<VerificationRow> {
  const distributor = await prisma.account.findFirst({
    where: { tenantId, accountName: DISTRIBUTOR_NAME },
    select: { id: true },
  })
  const vendor = await prisma.account.findFirst({
    where: { tenantId, accountName: row.vendorName },
    select: { id: true },
  })

  const product = distributor && vendor
    ? await prisma.product.findFirst({
        where: {
          tenantId,
          distributorAccountId: distributor.id,
          vendorAccountId: vendor.id,
          productNameHouse: row.houseProductName,
          productNameVendor: row.vendorProductName,
        },
        select: { id: true },
      })
    : null

  if (vendor && product) {
    return {
      rowNumber: row.rowNumber,
      actionType: row.rowNumber === 0 ? "Supplemental Product" : "Add Product",
      status: "present",
      details: `${row.vendorName} / ${row.houseProductName} -> ${row.vendorProductName}`,
    }
  }

  if (vendor || distributor) {
    return {
      rowNumber: row.rowNumber,
      actionType: row.rowNumber === 0 ? "Supplemental Product" : "Add Product",
      status: "partial",
      details: `vendor exists=${Boolean(vendor)} product exists=${Boolean(product)}`,
    }
  }

  return {
    rowNumber: row.rowNumber,
    actionType: row.rowNumber === 0 ? "Supplemental Product" : "Add Product",
    status: "missing",
    details: `vendor ${row.vendorName} missing`,
  }
}

async function verifyOpportunityRow(
  tenantId: string,
  row: (typeof opportunityPlanRows)[number]
): Promise<VerificationRow> {
  const account = await prisma.account.findFirst({
    where: {
      tenantId,
      accountName: row.accountName,
    },
    select: { id: true },
  })

  const opportunity = account
    ? await prisma.opportunity.findFirst({
        where: {
          tenantId,
          accountId: account.id,
          name: row.opportunityName,
        },
        select: { id: true },
      })
    : null

  const product = await prisma.product.findFirst({
    where: {
      tenantId,
      distributor: { accountName: DISTRIBUTOR_NAME },
      vendor: { accountName: row.vendorName },
      productNameHouse: row.houseProductName,
      productNameVendor: row.vendorProductName,
    },
    select: { id: true },
  })

  const opportunityProduct = opportunity && product
    ? await prisma.opportunityProduct.findFirst({
        where: {
          tenantId,
          opportunityId: opportunity.id,
          productId: product.id,
        },
        select: { id: true },
      })
    : null

  const schedules = opportunity
    ? await prisma.revenueSchedule.findMany({
        where: {
          tenantId,
          opportunityId: opportunity.id,
          deletedAt: null,
        },
        select: {
          id: true,
          expectedUsage: true,
          expectedCommission: true,
          expectedCommissionRatePercent: true,
        },
      })
    : []

  const matchingSchedules = schedules.filter(schedule => {
    return (
      approximatelyEqual(schedule.expectedUsage, row.expectedUsage) &&
      approximatelyEqual(schedule.expectedCommission, row.expectedCommission) &&
      approximatelyEqual(schedule.expectedCommissionRatePercent, row.expectedRatePercent, 0.001)
    )
  })

  const presentCount = [Boolean(account), Boolean(opportunity), Boolean(product), Boolean(opportunityProduct)].filter(Boolean)
    .length

  if (presentCount === 4 && matchingSchedules.length >= row.periods) {
    return {
      rowNumber: row.rowNumber,
      actionType: "New Acct + Opp",
      status: "present",
      details: `${row.accountName}; schedules=${matchingSchedules.length}/${row.periods}; usage=$${toMoney(row.expectedUsage)} rate=${row.expectedRatePercent}% commission=$${toMoney(row.expectedCommission)}`,
    }
  }

  if (presentCount > 0 || matchingSchedules.length > 0 || schedules.length > 0) {
    return {
      rowNumber: row.rowNumber,
      actionType: "New Acct + Opp",
      status: "partial",
      details: `account=${Boolean(account)} opp=${Boolean(opportunity)} product=${Boolean(product)} line=${Boolean(opportunityProduct)} schedules=${matchingSchedules.length}/${row.periods}`,
    }
  }

  return {
    rowNumber: row.rowNumber,
    actionType: "New Acct + Opp",
    status: "missing",
    details: `${row.accountName} not seeded`,
  }
}

async function verifyDoNotAddRow(
  tenantId: string,
  row: (typeof doNotAddPlanRows)[number]
): Promise<VerificationRow> {
  const account = await prisma.account.findFirst({
    where: {
      tenantId,
      accountName: row.accountName,
    },
    select: { id: true },
  })

  const opportunities = account
    ? await prisma.opportunity.findMany({
        where: {
          tenantId,
          accountId: account.id,
        },
        select: { id: true },
      })
    : []

  if (!row.accountOnly) {
    if (!account && opportunities.length === 0) {
      return {
        rowNumber: row.rowNumber,
        actionType: "DO NOT ADD",
        status: "present",
        details: `${row.accountName} correctly absent`,
      }
    }

    return {
      rowNumber: row.rowNumber,
      actionType: "DO NOT ADD",
      status: "partial",
      details: `${row.accountName} should stay absent but account=${Boolean(account)} opps=${opportunities.length}`,
    }
  }

  if (account && opportunities.length === 0) {
    return {
      rowNumber: row.rowNumber,
      actionType: "DO NOT ADD",
      status: "present",
      details: `${row.accountName} account-only state is ready`,
    }
  }

  if (account || opportunities.length > 0) {
    return {
      rowNumber: row.rowNumber,
      actionType: "DO NOT ADD",
      status: "partial",
      details: `${row.accountName} expected account-only; account=${Boolean(account)} opps=${opportunities.length}`,
    }
  }

  return {
    rowNumber: row.rowNumber,
    actionType: "DO NOT ADD",
    status: "missing",
    details: `${row.accountName} account-only prerequisite still missing`,
  }
}

async function main() {
  const tenantId = await getTenantId()
  const results: VerificationRow[] = []

  for (const row of allCatalogRows) {
    if (row.rowNumber === 0) continue
    results.push(await verifyCatalogRow(tenantId, row))
  }

  for (const row of opportunityPlanRows) {
    results.push(await verifyOpportunityRow(tenantId, row))
  }

  for (const row of doNotAddPlanRows) {
    results.push(await verifyDoNotAddRow(tenantId, row))
  }

  const counts = results.reduce(
    (acc, row) => {
      acc[row.status] += 1
      return acc
    },
    { present: 0, partial: 0, missing: 0 }
  )

  console.log(JSON.stringify({ counts, results }, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
