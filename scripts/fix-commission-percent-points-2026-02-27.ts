import dotenv from "dotenv"
import { Prisma, PrismaClient } from "@prisma/client"

dotenv.config({ path: ".env" })

const prisma = new PrismaClient()

const TARGET_PRODUCT_IDS = [
  "c01fe7b3-2097-445a-b2a9-5c24f3f8015c", // UCaaS Voice Bundle (License + Handset)
  "af72c0af-3125-4384-9128-f4397e512da3", // VoIP Service Bundle
  "35125899-2607-41d2-9b14-c017538d145d", // MSP Services
] as const

const TARGET_OPPORTUNITY_PRODUCT_IDS = [
  "75e1ef1f-9362-4952-a57e-08bb5e72938c",
  "25f801ef-b4b8-4359-9e46-a455f10bf709",
  "70f5220a-2c67-4e8b-b614-838fbb8e62e3",
] as const

const EXPECTED_BAD_VALUE = 0.16
const FIXED_VALUE = 16.0

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const numeric = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function assertExpectedBadValue(label: string, id: string, rawValue: unknown) {
  const numeric = toNumber(rawValue)
  if (numeric === null) {
    throw new Error(`${label} ${id} has null/invalid commission value; refusing to update`)
  }
  if (Math.abs(numeric - EXPECTED_BAD_VALUE) > 1e-9) {
    throw new Error(
      `${label} ${id} has commission value ${numeric}; expected ${EXPECTED_BAD_VALUE}. Refusing to update.`
    )
  }
}

async function main() {
  const products = await prisma.product.findMany({
    where: { id: { in: [...TARGET_PRODUCT_IDS] } },
    select: { id: true, productCode: true, productNameHouse: true, commissionPercent: true },
  })

  const oppProducts = await (prisma.opportunityProduct as any).findMany({
    where: { id: { in: [...TARGET_OPPORTUNITY_PRODUCT_IDS] } },
    select: {
      id: true,
      productCodeSnapshot: true,
      productNameHouseSnapshot: true,
      commissionPercentSnapshot: true,
    },
  })

  const missingProducts = TARGET_PRODUCT_IDS.filter((id) => !products.some((p) => p.id === id))
  const missingOppProducts = TARGET_OPPORTUNITY_PRODUCT_IDS.filter((id) => !oppProducts.some((p: any) => p.id === id))
  if (missingProducts.length > 0 || missingOppProducts.length > 0) {
    throw new Error(
      `Missing records: products=[${missingProducts.join(", ")}], opportunityProducts=[${missingOppProducts.join(", ")}]`
    )
  }

  for (const p of products) {
    assertExpectedBadValue("Product", p.id, p.commissionPercent)
  }
  for (const op of oppProducts as any[]) {
    assertExpectedBadValue("OpportunityProduct", op.id, op.commissionPercentSnapshot)
  }

  const fixedDecimal = new Prisma.Decimal(FIXED_VALUE)

  const result = await prisma.$transaction(async (tx) => {
    const productUpdates = await Promise.all(
      TARGET_PRODUCT_IDS.map((id) =>
        tx.product.update({
          where: { id },
          data: { commissionPercent: fixedDecimal },
          select: { id: true, commissionPercent: true },
        })
      )
    )

    const oppProductUpdates = await Promise.all(
      TARGET_OPPORTUNITY_PRODUCT_IDS.map((id) =>
        (tx.opportunityProduct as any).update({
          where: { id },
          data: { commissionPercentSnapshot: fixedDecimal },
          select: { id: true, commissionPercentSnapshot: true },
        })
      )
    )

    return { productUpdates, oppProductUpdates }
  })

  const output = {
    fixedValue: FIXED_VALUE,
    products: result.productUpdates.map((p) => ({ id: p.id, commissionPercent: toNumber(p.commissionPercent) })),
    opportunityProducts: (result.oppProductUpdates as any[]).map((p) => ({
      id: p.id,
      commissionPercentSnapshot: toNumber(p.commissionPercentSnapshot),
    })),
  }
  console.log(JSON.stringify(output, null, 2))
}

main()
  .catch((error) => {
    console.error("ERROR", error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

