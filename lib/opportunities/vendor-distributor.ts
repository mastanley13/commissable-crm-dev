import { Prisma, PrismaClient } from "@prisma/client"

export type DbClient = PrismaClient | Prisma.TransactionClient

export type VendorDistributorPair = {
  distributorAccountId: string | null
  vendorAccountId: string | null
}

function pairsEqual(a: VendorDistributorPair, b: VendorDistributorPair): boolean {
  const aDistributor = a.distributorAccountId ?? null
  const aVendor = a.vendorAccountId ?? null
  const bDistributor = b.distributorAccountId ?? null
  const bVendor = b.vendorAccountId ?? null

  return aDistributor === bDistributor && aVendor === bVendor
}

async function getCanonicalPairForOpportunity(
  db: DbClient,
  tenantId: string,
  opportunityId: string
): Promise<VendorDistributorPair | null> {
  const lineItems = await db.opportunityProduct.findMany({
    where: { tenantId, opportunityId },
    select: {
      product: {
        select: {
          distributorAccountId: true,
          vendorAccountId: true
        }
      }
    }
  })

  for (const item of lineItems) {
    const distributorAccountId = item.product?.distributorAccountId ?? null
    const vendorAccountId = item.product?.vendorAccountId ?? null

    if (distributorAccountId || vendorAccountId) {
      return { distributorAccountId, vendorAccountId }
    }
  }

  return null
}

/**
 * Ensures that the provided vendor/distributor pair is consistent with
 * any existing line items on the given Opportunity.
 *
 * If the Opportunity has no existing vendor/distributor context, the pair is accepted.
 * If a canonical pair exists and the new pair differs, an error with code
 * "OPPORTUNITY_VENDOR_DISTRIBUTOR_MISMATCH" is thrown.
 */
export async function assertVendorDistributorConsistentForOpportunity(
  db: DbClient,
  tenantId: string,
  opportunityId: string,
  newPair: VendorDistributorPair
): Promise<void> {
  const canonical = await getCanonicalPairForOpportunity(db, tenantId, opportunityId)

  if (!canonical) {
    // No existing context – any pair is acceptable.
    return
  }

  if (pairsEqual(canonical, newPair)) {
    return
  }

  const error = new Error("Cannot have more than one Distributor/Vendor on the same Opportunity.")
  ;(error as any).code = "OPPORTUNITY_VENDOR_DISTRIBUTOR_MISMATCH"
  throw error
}

