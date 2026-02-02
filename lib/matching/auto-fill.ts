import { AuditAction, Prisma } from "@prisma/client"
import { canonicalizeMultiValueString, isMultiValueEmpty } from "@/lib/multi-value"
import { getChangedFields } from "@/lib/audit"

type Tx = Prisma.TransactionClient

export type AutoFillFromMatchParams = {
  tenantId: string
  userId: string
  depositId: string
  depositLineItemId: string
  revenueScheduleId: string
  depositLineMatchId?: string | null
  ipAddress?: string
  userAgent?: string
}

const OPPORTUNITY_ID_FIELDS = ["accountIdVendor", "customerIdVendor", "orderIdVendor"] as const
const PRODUCT_FIELDS = ["productNameVendor", "partNumberVendor"] as const

export async function autoFillFromDepositMatch(tx: Tx, params: AutoFillFromMatchParams) {
  const schedule = await tx.revenueSchedule.findFirst({
    where: { id: params.revenueScheduleId, tenantId: params.tenantId },
    select: { id: true, opportunityId: true, productId: true },
  })

  if (!schedule) {
    return { auditLogIds: [] as string[] }
  }

  const line = await tx.depositLineItem.findFirst({
    where: { id: params.depositLineItemId, tenantId: params.tenantId },
    select: {
      id: true,
      accountIdVendor: true,
      customerIdVendor: true,
      orderIdVendor: true,
      productNameRaw: true,
      partNumberRaw: true,
    },
  })

  if (!line) {
    return { auditLogIds: [] as string[] }
  }

  const auditLogIds: string[] = []

  if (schedule.opportunityId) {
    const existing = await tx.opportunity.findFirst({
      where: { id: schedule.opportunityId, tenantId: params.tenantId },
      select: {
        id: true,
        accountIdVendor: true,
        customerIdVendor: true,
        orderIdVendor: true,
      },
    })

    if (existing) {
      const update: Record<string, string | null> = {}

      const candidateAccountIdVendor = canonicalizeMultiValueString(line.accountIdVendor, { kind: "id" })
      const candidateCustomerIdVendor = canonicalizeMultiValueString(line.customerIdVendor, { kind: "id" })
      const candidateOrderIdVendor = canonicalizeMultiValueString(line.orderIdVendor, { kind: "id" })

      if (isMultiValueEmpty(existing.accountIdVendor, { kind: "id" }) && candidateAccountIdVendor) {
        update.accountIdVendor = candidateAccountIdVendor
      }
      if (isMultiValueEmpty(existing.customerIdVendor, { kind: "id" }) && candidateCustomerIdVendor) {
        update.customerIdVendor = candidateCustomerIdVendor
      }
      if (isMultiValueEmpty(existing.orderIdVendor, { kind: "id" }) && candidateOrderIdVendor) {
        update.orderIdVendor = candidateOrderIdVendor
      }

      if (Object.keys(update).length > 0) {
        const updated = await tx.opportunity.update({
          where: { id: existing.id },
          data: update,
          select: { id: true, accountIdVendor: true, customerIdVendor: true, orderIdVendor: true },
        })

        const previousValues: Record<string, unknown> = {}
        const newValues: Record<string, unknown> = {}
        for (const key of OPPORTUNITY_ID_FIELDS) {
          if (!(key in update)) continue
          previousValues[key] = (existing as any)[key] ?? null
          newValues[key] = (updated as any)[key] ?? null
        }

        const changedFields = getChangedFields(previousValues, newValues)
        const audit = await tx.auditLog.create({
          data: {
            tenantId: params.tenantId,
            userId: params.userId,
            action: AuditAction.Update,
            entityName: "Opportunity",
            entityId: existing.id,
            changedFields,
            previousValues: JSON.parse(JSON.stringify(previousValues)),
            newValues: JSON.parse(JSON.stringify(newValues)),
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            metadata: JSON.parse(
              JSON.stringify({
                action: "AutoFillFromDepositMatch",
                depositId: params.depositId,
                depositLineItemId: params.depositLineItemId,
                revenueScheduleId: params.revenueScheduleId,
                depositLineMatchId: params.depositLineMatchId ?? null,
                fields: Object.keys(update),
              }),
            ),
          },
          select: { id: true },
        })
        auditLogIds.push(audit.id)
      }
    }
  }

  if (schedule.productId) {
    const existing = await tx.product.findFirst({
      where: { id: schedule.productId, tenantId: params.tenantId },
      select: {
        id: true,
        productNameVendor: true,
        partNumberVendor: true,
      } as any,
    })

    if (existing) {
      const update: Record<string, string | null> = {}

      const candidateProductNameVendor = canonicalizeMultiValueString(line.productNameRaw, { kind: "text" })
      const candidatePartNumberVendor = canonicalizeMultiValueString(line.partNumberRaw, { kind: "id" })

      if (isMultiValueEmpty((existing as any).productNameVendor, { kind: "text" }) && candidateProductNameVendor) {
        update.productNameVendor = candidateProductNameVendor
      }
      if (isMultiValueEmpty((existing as any).partNumberVendor, { kind: "id" }) && candidatePartNumberVendor) {
        update.partNumberVendor = candidatePartNumberVendor
      }

      if (Object.keys(update).length > 0) {
        const updated = await tx.product.update({
          where: { id: schedule.productId },
          data: update as any,
          select: { id: true, productNameVendor: true, partNumberVendor: true } as any,
        })

        const previousValues: Record<string, unknown> = {}
        const newValues: Record<string, unknown> = {}
        for (const key of PRODUCT_FIELDS) {
          if (!(key in update)) continue
          previousValues[key] = (existing as any)[key] ?? null
          newValues[key] = (updated as any)[key] ?? null
        }

        const changedFields = getChangedFields(previousValues, newValues)
        const audit = await tx.auditLog.create({
          data: {
            tenantId: params.tenantId,
            userId: params.userId,
            action: AuditAction.Update,
            entityName: "Product",
            entityId: schedule.productId,
            changedFields,
            previousValues: JSON.parse(JSON.stringify(previousValues)),
            newValues: JSON.parse(JSON.stringify(newValues)),
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            metadata: JSON.parse(
              JSON.stringify({
                action: "AutoFillFromDepositMatch",
                depositId: params.depositId,
                depositLineItemId: params.depositLineItemId,
                revenueScheduleId: params.revenueScheduleId,
                depositLineMatchId: params.depositLineMatchId ?? null,
                fields: Object.keys(update),
              }),
            ),
          },
          select: { id: true },
        })
        auditLogIds.push(audit.id)
      }
    }
  }

  return { auditLogIds }
}
