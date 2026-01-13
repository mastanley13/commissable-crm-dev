import type { Prisma, PrismaClient, RevenueScheduleFlexClassification, RevenueScheduleFlexReasonCode } from "@prisma/client"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

export async function enqueueFlexReviewItem(
  tx: PrismaClientOrTx,
  {
    tenantId,
    createdById,
    revenueScheduleId,
    flexClassification,
    flexReasonCode,
    sourceDepositId,
    sourceDepositLineItemId,
    title,
    body,
    metadata,
  }: {
    tenantId: string
    createdById: string
    revenueScheduleId: string
    flexClassification: RevenueScheduleFlexClassification
    flexReasonCode: RevenueScheduleFlexReasonCode | null
    sourceDepositId: string | null
    sourceDepositLineItemId: string | null
    title: string
    body: string
    metadata?: Prisma.InputJsonValue
  },
) {
  await tx.flexReviewItem.upsert({
    where: {
      tenantId_revenueScheduleId: {
        tenantId,
        revenueScheduleId,
      },
    },
    create: {
      tenantId,
      revenueScheduleId,
      flexClassification,
      flexReasonCode: flexReasonCode ?? undefined,
      sourceDepositId: sourceDepositId ?? undefined,
      sourceDepositLineItemId: sourceDepositLineItemId ?? undefined,
      createdById,
      status: "Open",
    },
    update: {
      flexClassification,
      flexReasonCode: flexReasonCode ?? undefined,
      sourceDepositId: sourceDepositId ?? undefined,
      sourceDepositLineItemId: sourceDepositLineItemId ?? undefined,
    },
    select: { id: true },
  })

  const reviewers = await tx.user.findMany({
    where: {
      tenantId,
      role: {
        permissions: {
          some: {
            permission: { code: "reconciliation.manage" },
          },
        },
      },
    },
    select: { id: true },
  })

  if (!reviewers.length) return

  await tx.notification.createMany({
    data: reviewers.map(reviewer => ({
      tenantId,
      userId: reviewer.id,
      title,
      body,
      metadata: (metadata ?? null) as any,
    })),
  })
}

