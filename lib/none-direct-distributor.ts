import { AccountStatus, Prisma, PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/db"

export const NONE_DIRECT_DISTRIBUTOR_NAME = "None-Direct"

type DbClient = PrismaClient | Prisma.TransactionClient

async function ensureDistributorAccountType(tenantId: string, db: DbClient) {
  const existing = await db.accountType.findFirst({
    where: {
      tenantId,
      OR: [
        { code: { equals: "DISTRIBUTOR", mode: "insensitive" } },
        { name: { equals: "Distributor", mode: "insensitive" } }
      ]
    }
  })

  if (!existing) {
    return db.accountType.create({
      data: {
        tenantId,
        code: "DISTRIBUTOR",
        name: "Distributor",
        displayOrder: 20,
        isAssignableToContacts: true
      }
    })
  }

  const needsUpdate =
    existing.code !== "DISTRIBUTOR" ||
    existing.name !== "Distributor" ||
    existing.displayOrder !== 20 ||
    existing.isAssignableToContacts !== true

  return needsUpdate
    ? db.accountType.update({
        where: { id: existing.id },
        data: {
          code: "DISTRIBUTOR",
          name: "Distributor",
          displayOrder: 20,
          isAssignableToContacts: true
        }
      })
    : existing
}

export async function ensureNoneDirectDistributorAccount(
  tenantId: string,
  client?: DbClient
): Promise<{ id: string; accountName: string; accountTypeId: string }> {
  const db = client ?? prisma

  const distributorType = await ensureDistributorAccountType(tenantId, db)

  const existing = await db.account.findFirst({
    where: {
      tenantId,
      accountName: { equals: NONE_DIRECT_DISTRIBUTOR_NAME, mode: "insensitive" }
    },
    select: { id: true, accountName: true, accountTypeId: true, status: true }
  })

  if (existing) {
    if (
      existing.accountTypeId !== distributorType.id ||
      existing.status !== AccountStatus.Active
    ) {
      const updated = await db.account.update({
        where: { id: existing.id },
        data: {
          accountTypeId: distributorType.id,
          status: AccountStatus.Active
        },
        select: { id: true, accountName: true, accountTypeId: true }
      })
      return updated
    }

    return existing
  }

  const created = await db.account.create({
    data: {
      tenantId,
      accountTypeId: distributorType.id,
      accountName: NONE_DIRECT_DISTRIBUTOR_NAME,
      accountLegalName: NONE_DIRECT_DISTRIBUTOR_NAME,
      status: AccountStatus.Active,
      description: "Direct-vendor placeholder distributor"
    },
    select: { id: true, accountName: true, accountTypeId: true }
  })

  return created
}

