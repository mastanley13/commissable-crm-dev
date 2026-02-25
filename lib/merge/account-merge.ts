import { AccountStatus, AuditAction } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { MergeExecuteRequest, MergeExecuteResult, MergePreview, RelatedCount } from "./merge-types"
import { buildFieldConflicts, resolveMergedFieldValue } from "./merge-utils"

const ACCOUNT_MERGE_FIELDS = [
  "accountName",
  "accountLegalName",
  "accountNumber",
  "websiteUrl",
  "supportEmail",
  "phone",
  "fax",
  "annualRevenue",
  "employeeCount",
  "sicCode",
  "taxId",
  "description",
  "notes",
  "industryId",
  "ownerId",
  "parentAccountId",
  "shippingAddressId",
  "billingAddressId",
] as const

type AccountMergeField = (typeof ACCOUNT_MERGE_FIELDS)[number]

type AccountPreviewRecord = {
  id: string
  tenantId: string
  accountName: string
  accountLegalName: string | null
  accountNumber: string | null
  websiteUrl: string | null
  supportEmail: string | null
  phone: string | null
  fax: string | null
  annualRevenue: unknown
  employeeCount: number | null
  sicCode: string | null
  taxId: string | null
  description: string | null
  notes: string | null
  industryId: string | null
  ownerId: string | null
  parentAccountId: string | null
  shippingAddressId: string | null
  billingAddressId: string | null
  status: AccountStatus
  mergedIntoAccountId: string | null
  mergedAt: Date | null
}

function mapAccountPreviewFields(account: AccountPreviewRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  for (const key of ACCOUNT_MERGE_FIELDS) {
    fields[key] = account[key]
  }
  return fields
}

async function countAccountMergeRelated(
  tenantId: string,
  sourceAccountId: string
): Promise<RelatedCount[]> {
  const [
    contacts,
    opportunities,
    activities,
    tickets,
    revenueSchedules,
    reconciliations,
    deposits,
    depositLineItems,
    accountNotes,
    assignments,
    groupMembers,
    productsAsVendor,
    productsAsDistributor,
    productsAsFlex,
    templatesAsVendor,
    templatesAsDistributor,
  ] = await Promise.all([
    prisma.contact.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.opportunity.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.activity.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.ticket.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.revenueSchedule.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.reconciliation.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.deposit.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.depositLineItem.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.accountNote.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.accountAssignment.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.groupMember.count({ where: { tenantId, accountId: sourceAccountId } }),
    prisma.product.count({ where: { tenantId, vendorAccountId: sourceAccountId } }),
    prisma.product.count({ where: { tenantId, distributorAccountId: sourceAccountId } }),
    prisma.product.count({ where: { tenantId, flexAccountId: sourceAccountId } }),
    prisma.reconciliationTemplate.count({ where: { tenantId, vendorAccountId: sourceAccountId } }),
    prisma.reconciliationTemplate.count({ where: { tenantId, distributorAccountId: sourceAccountId } }),
  ])

  return [
    { label: "Contacts", count: contacts },
    { label: "Opportunities", count: opportunities },
    { label: "Activities", count: activities },
    { label: "Tickets", count: tickets },
    { label: "Revenue Schedules", count: revenueSchedules },
    { label: "Reconciliations", count: reconciliations },
    { label: "Deposits", count: deposits },
    { label: "Deposit Line Items", count: depositLineItems },
    { label: "Account Notes", count: accountNotes },
    { label: "Account Assignments", count: assignments },
    { label: "Group Memberships", count: groupMembers },
    { label: "Products (Vendor)", count: productsAsVendor },
    { label: "Products (Distributor)", count: productsAsDistributor },
    { label: "Products (Flex)", count: productsAsFlex },
    { label: "Reconciliation Templates (Vendor)", count: templatesAsVendor },
    { label: "Reconciliation Templates (Distributor)", count: templatesAsDistributor },
  ].filter(entry => entry.count > 0)
}

async function getAccountMergeCollisions(
  tenantId: string,
  targetAccountId: string,
  sourceAccountId: string
) {
  const collisions: Array<{ type: string; message: string }> = []

  const [reconciliationOverlap] = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "Reconciliation" s
    JOIN "Reconciliation" t
      ON s."tenantId" = t."tenantId"
     AND s."month" = t."month"
    WHERE s."tenantId" = ${tenantId}
      AND s."accountId" = ${sourceAccountId}
      AND t."accountId" = ${targetAccountId}
  `

  if (Number(reconciliationOverlap?.count ?? 0) > 0) {
    collisions.push({
      type: "reconciliation_unique_month",
      message:
        "Both accounts have reconciliations for the same month. Merge would violate the unique (tenantId, accountId, month) constraint."
    })
  }

  const [templateDistributorOverlap] = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "ReconciliationTemplate" s
    JOIN "ReconciliationTemplate" t
      ON s."tenantId" = t."tenantId"
     AND s."vendorAccountId" = t."vendorAccountId"
     AND s."name" = t."name"
    WHERE s."tenantId" = ${tenantId}
      AND s."distributorAccountId" = ${sourceAccountId}
      AND t."distributorAccountId" = ${targetAccountId}
  `

  if (Number(templateDistributorOverlap?.count ?? 0) > 0) {
    collisions.push({
      type: "reconciliation_template_unique_distributor",
      message:
        "Reconciliation template collision: merging distributor templates from source -> target would violate unique (tenantId, distributorAccountId, vendorAccountId, name)."
    })
  }

  const [templateVendorOverlap] = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "ReconciliationTemplate" s
    JOIN "ReconciliationTemplate" t
      ON s."tenantId" = t."tenantId"
     AND s."distributorAccountId" = t."distributorAccountId"
     AND s."name" = t."name"
    WHERE s."tenantId" = ${tenantId}
      AND s."vendorAccountId" = ${sourceAccountId}
      AND t."vendorAccountId" = ${targetAccountId}
  `

  if (Number(templateVendorOverlap?.count ?? 0) > 0) {
    collisions.push({
      type: "reconciliation_template_unique_vendor",
      message:
        "Reconciliation template collision: merging vendor templates from source -> target would violate unique (tenantId, distributorAccountId, vendorAccountId, name)."
    })
  }

  return collisions
}

export async function previewAccountMerge(params: {
  tenantId: string
  targetId: string
  sourceId: string
}): Promise<MergePreview> {
  const { tenantId, targetId, sourceId } = params

  if (targetId === sourceId) {
    throw new Error("Target and source must be different records.")
  }

  const [target, source] = await Promise.all([
    prisma.account.findFirst({
      where: { tenantId, id: targetId },
      select: {
        id: true,
        tenantId: true,
        accountName: true,
        accountLegalName: true,
        accountNumber: true,
        websiteUrl: true,
        supportEmail: true,
        phone: true,
        fax: true,
        annualRevenue: true,
        employeeCount: true,
        sicCode: true,
        taxId: true,
        description: true,
        notes: true,
        industryId: true,
        ownerId: true,
        parentAccountId: true,
        shippingAddressId: true,
        billingAddressId: true,
        status: true,
        mergedIntoAccountId: true,
        mergedAt: true,
      }
    }),
    prisma.account.findFirst({
      where: { tenantId, id: sourceId },
      select: {
        id: true,
        tenantId: true,
        accountName: true,
        accountLegalName: true,
        accountNumber: true,
        websiteUrl: true,
        supportEmail: true,
        phone: true,
        fax: true,
        annualRevenue: true,
        employeeCount: true,
        sicCode: true,
        taxId: true,
        description: true,
        notes: true,
        industryId: true,
        ownerId: true,
        parentAccountId: true,
        shippingAddressId: true,
        billingAddressId: true,
        status: true,
        mergedIntoAccountId: true,
        mergedAt: true,
      }
    }),
  ])

  if (!target || !source) {
    throw new Error("Target or source record not found.")
  }

  const fieldConflicts = buildFieldConflicts(
    [...ACCOUNT_MERGE_FIELDS],
    target as unknown as Record<string, unknown>,
    source as unknown as Record<string, unknown>
  )

  const [relatedCounts, collisions] = await Promise.all([
    countAccountMergeRelated(tenantId, sourceId),
    getAccountMergeCollisions(tenantId, targetId, sourceId),
  ])

  if (target.mergedIntoAccountId) {
    collisions.push({
      type: "target_already_merged",
      message: "Target account is already merged into another account."
    })
  }

  if (source.mergedIntoAccountId && source.mergedIntoAccountId !== targetId) {
    collisions.push({
      type: "source_already_merged",
      message: "Source account is already merged into another account."
    })
  }

  return {
    entity: "Account",
    target: {
      id: target.id,
      displayLabel: target.accountName,
      fields: mapAccountPreviewFields(target as AccountPreviewRecord)
    },
    source: {
      id: source.id,
      displayLabel: source.accountName,
      fields: mapAccountPreviewFields(source as AccountPreviewRecord)
    },
    fieldConflicts,
    relatedCounts,
    collisions
  }
}

export async function executeAccountMerge(
  request: MergeExecuteRequest
): Promise<MergeExecuteResult> {
  const { tenantId, userId, targetId, sourceId, fieldWinners, dryRun } = request

  if (targetId === sourceId) {
    throw new Error("Target and source must be different records.")
  }

  const now = new Date()

  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${targetId} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${sourceId} FOR UPDATE`

    const [target, source] = await Promise.all([
      tx.account.findFirst({
        where: { tenantId, id: targetId },
        select: {
          id: true,
          tenantId: true,
          accountName: true,
          accountLegalName: true,
          accountNumber: true,
          websiteUrl: true,
          supportEmail: true,
          phone: true,
          fax: true,
          annualRevenue: true,
          employeeCount: true,
          sicCode: true,
          taxId: true,
          description: true,
          notes: true,
          industryId: true,
          ownerId: true,
          parentAccountId: true,
          shippingAddressId: true,
          billingAddressId: true,
          status: true,
          mergedIntoAccountId: true,
          mergedAt: true,
        }
      }),
      tx.account.findFirst({
        where: { tenantId, id: sourceId },
        select: {
          id: true,
          tenantId: true,
          accountName: true,
          accountLegalName: true,
          accountNumber: true,
          websiteUrl: true,
          supportEmail: true,
          phone: true,
          fax: true,
          annualRevenue: true,
          employeeCount: true,
          sicCode: true,
          taxId: true,
          description: true,
          notes: true,
          industryId: true,
          ownerId: true,
          parentAccountId: true,
          shippingAddressId: true,
          billingAddressId: true,
          status: true,
          mergedIntoAccountId: true,
          mergedAt: true,
        }
      }),
    ])

    if (!target || !source) {
      throw new Error("Target or source record not found.")
    }

    if (target.mergedIntoAccountId) {
      throw new Error("Target account is already merged into another account.")
    }

    if (source.mergedIntoAccountId && source.mergedIntoAccountId !== targetId) {
      throw new Error("Source account is already merged into another account.")
    }

    const collisions = await (async () => {
      const [reconciliationOverlap] = await tx.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Reconciliation" s
        JOIN "Reconciliation" t
          ON s."tenantId" = t."tenantId"
         AND s."month" = t."month"
        WHERE s."tenantId" = ${tenantId}
          AND s."accountId" = ${sourceId}
          AND t."accountId" = ${targetId}
      `

      const [templateDistributorOverlap] = await tx.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "ReconciliationTemplate" s
        JOIN "ReconciliationTemplate" t
          ON s."tenantId" = t."tenantId"
         AND s."vendorAccountId" = t."vendorAccountId"
         AND s."name" = t."name"
        WHERE s."tenantId" = ${tenantId}
          AND s."distributorAccountId" = ${sourceId}
          AND t."distributorAccountId" = ${targetId}
      `

      const [templateVendorOverlap] = await tx.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "ReconciliationTemplate" s
        JOIN "ReconciliationTemplate" t
          ON s."tenantId" = t."tenantId"
         AND s."distributorAccountId" = t."distributorAccountId"
         AND s."name" = t."name"
        WHERE s."tenantId" = ${tenantId}
          AND s."vendorAccountId" = ${sourceId}
          AND t."vendorAccountId" = ${targetId}
      `

      const hasCollision =
        Number(reconciliationOverlap?.count ?? 0) > 0 ||
        Number(templateDistributorOverlap?.count ?? 0) > 0 ||
        Number(templateVendorOverlap?.count ?? 0) > 0

      return hasCollision
    })()

    if (collisions) {
      throw new Error(
        "Merge blocked due to collisions (reconciliations and/or reconciliation templates would violate uniqueness constraints)."
      )
    }

    const movedCounts = await (async () => {
      const [
        contacts,
        opportunities,
        activities,
        tickets,
        revenueSchedules,
        reconciliations,
        deposits,
        depositLineItems,
        accountNotes,
        assignments,
        groupMembers,
        productsAsVendor,
        productsAsDistributor,
        productsAsFlex,
        templatesAsVendor,
        templatesAsDistributor,
      ] = await Promise.all([
        tx.contact.count({ where: { tenantId, accountId: sourceId } }),
        tx.opportunity.count({ where: { tenantId, accountId: sourceId } }),
        tx.activity.count({ where: { tenantId, accountId: sourceId } }),
        tx.ticket.count({ where: { tenantId, accountId: sourceId } }),
        tx.revenueSchedule.count({ where: { tenantId, accountId: sourceId } }),
        tx.reconciliation.count({ where: { tenantId, accountId: sourceId } }),
        tx.deposit.count({ where: { tenantId, accountId: sourceId } }),
        tx.depositLineItem.count({ where: { tenantId, accountId: sourceId } }),
        tx.accountNote.count({ where: { tenantId, accountId: sourceId } }),
        tx.accountAssignment.count({ where: { tenantId, accountId: sourceId } }),
        tx.groupMember.count({ where: { tenantId, accountId: sourceId } }),
        tx.product.count({ where: { tenantId, vendorAccountId: sourceId } }),
        tx.product.count({ where: { tenantId, distributorAccountId: sourceId } }),
        tx.product.count({ where: { tenantId, flexAccountId: sourceId } }),
        tx.reconciliationTemplate.count({ where: { tenantId, vendorAccountId: sourceId } }),
        tx.reconciliationTemplate.count({ where: { tenantId, distributorAccountId: sourceId } }),
      ])

      return [
        { label: "Contacts", count: contacts },
        { label: "Opportunities", count: opportunities },
        { label: "Activities", count: activities },
        { label: "Tickets", count: tickets },
        { label: "Revenue Schedules", count: revenueSchedules },
        { label: "Reconciliations", count: reconciliations },
        { label: "Deposits", count: deposits },
        { label: "Deposit Line Items", count: depositLineItems },
        { label: "Account Notes", count: accountNotes },
        { label: "Account Assignments", count: assignments },
        { label: "Group Memberships", count: groupMembers },
        { label: "Products (Vendor)", count: productsAsVendor },
        { label: "Products (Distributor)", count: productsAsDistributor },
        { label: "Products (Flex)", count: productsAsFlex },
        { label: "Reconciliation Templates (Vendor)", count: templatesAsVendor },
        { label: "Reconciliation Templates (Distributor)", count: templatesAsDistributor },
      ].filter(entry => entry.count > 0)
    })()

    if (dryRun) {
      const audit = await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: AuditAction.Merge,
          entityName: "Account",
          entityId: targetId,
          metadata: JSON.stringify({
            dryRun: true,
            sourceId,
            movedCounts
          })
        }
      })

      return {
        ok: true,
        entity: "Account",
        targetId,
        sourceId,
        moved: movedCounts,
        auditLogId: audit.id
      }
    }

    const mergedAccountName = resolveMergedFieldValue<string>(
      "accountName",
      target as unknown as Record<string, unknown>,
      source as unknown as Record<string, unknown>,
      fieldWinners
    )

    if (!mergedAccountName || mergedAccountName.trim().length === 0) {
      throw new Error("Account Name cannot be empty.")
    }

    const nameCollision = await tx.account.count({
      where: {
        tenantId,
        accountName: { equals: mergedAccountName.trim(), mode: "insensitive" },
        id: { not: targetId }
      }
    })

    if (nameCollision > 0) {
      throw new Error("Account Name must be unique. The selected merged name is already in use.")
    }

    const updateTargetData: Record<string, unknown> = {}
    for (const key of ACCOUNT_MERGE_FIELDS) {
      updateTargetData[key] = resolveMergedFieldValue(
        key,
        target as unknown as Record<string, unknown>,
        source as unknown as Record<string, unknown>,
        fieldWinners
      )
    }

    // Prevent a self-loop if the target currently reports a parent of the source.
    if (target.parentAccountId === sourceId) {
      updateTargetData.parentAccountId = source.parentAccountId
    }

    await tx.account.update({
      where: { id: targetId },
      data: {
        ...(updateTargetData as any),
        updatedById: userId
      }
    })

    // Resolve assignment PK collisions (accountId + userId) by deleting the source duplicates.
    const sourceAssignmentUserIds = await tx.accountAssignment.findMany({
      where: { tenantId, accountId: sourceId },
      select: { userId: true }
    })

    const userIds = sourceAssignmentUserIds.map(entry => entry.userId)
    if (userIds.length > 0) {
      const targetAssignments = await tx.accountAssignment.findMany({
        where: { tenantId, accountId: targetId, userId: { in: userIds } },
        select: { userId: true }
      })
      const duplicateUserIds = targetAssignments.map(entry => entry.userId)
      if (duplicateUserIds.length > 0) {
        await tx.accountAssignment.deleteMany({
          where: { tenantId, accountId: sourceId, userId: { in: duplicateUserIds } }
        })
      }
    }

    // Resolve group membership uniqueness collisions.
    const sourceGroupIds = await tx.groupMember.findMany({
      where: { tenantId, accountId: sourceId },
      select: { groupId: true, memberType: true }
    })

    if (sourceGroupIds.length > 0) {
      const groupIds = Array.from(new Set(sourceGroupIds.map(entry => entry.groupId)))
      const targetGroupMembers = await tx.groupMember.findMany({
        where: { tenantId, accountId: targetId, groupId: { in: groupIds } },
        select: { groupId: true, memberType: true }
      })

      const existingKeys = new Set(targetGroupMembers.map(entry => `${entry.groupId}:${entry.memberType}`))
      const dupGroupIds = sourceGroupIds
        .filter(entry => existingKeys.has(`${entry.groupId}:${entry.memberType}`))
        .map(entry => entry.groupId)

      if (dupGroupIds.length > 0) {
        await tx.groupMember.deleteMany({
          where: { tenantId, accountId: sourceId, groupId: { in: dupGroupIds } }
        })
      }
    }

    const [
      contactsMove,
      activitiesMove,
      opportunitiesMove,
      revenueSchedulesMove,
      ticketsMove,
      accountNotesMove,
      assignmentsMove,
      reconciliationsMove,
      depositsMove,
      depositLineItemsMove,
      groupMembersMove,
      productsVendorMove,
      productsDistributorMove,
      productsFlexMove,
      templatesDistributorMove,
      templatesVendorMove,
      ticketsDistributorMove,
      ticketsVendorMove,
      depositsDistributorMove,
      depositsVendorMove,
      revenueSchedulesDistributorMove,
      revenueSchedulesVendorMove,
      depositLineItemVendorMove,
      childAccountsMove,
    ] = await Promise.all([
      tx.contact.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.activity.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.opportunity.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.revenueSchedule.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.ticket.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.accountNote.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.accountAssignment.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.reconciliation.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.deposit.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.depositLineItem.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.groupMember.updateMany({ where: { tenantId, accountId: sourceId }, data: { accountId: targetId } }),
      tx.product.updateMany({ where: { tenantId, vendorAccountId: sourceId }, data: { vendorAccountId: targetId } }),
      tx.product.updateMany({
        where: { tenantId, distributorAccountId: sourceId },
        data: { distributorAccountId: targetId }
      }),
      tx.product.updateMany({ where: { tenantId, flexAccountId: sourceId }, data: { flexAccountId: targetId } }),
      tx.reconciliationTemplate.updateMany({
        where: { tenantId, distributorAccountId: sourceId },
        data: { distributorAccountId: targetId }
      }),
      tx.reconciliationTemplate.updateMany({
        where: { tenantId, vendorAccountId: sourceId },
        data: { vendorAccountId: targetId }
      }),
      tx.ticket.updateMany({
        where: { tenantId, distributorAccountId: sourceId },
        data: { distributorAccountId: targetId }
      }),
      tx.ticket.updateMany({ where: { tenantId, vendorAccountId: sourceId }, data: { vendorAccountId: targetId } }),
      tx.deposit.updateMany({
        where: { tenantId, distributorAccountId: sourceId },
        data: { distributorAccountId: targetId }
      }),
      tx.deposit.updateMany({ where: { tenantId, vendorAccountId: sourceId }, data: { vendorAccountId: targetId } }),
      tx.revenueSchedule.updateMany({
        where: { tenantId, distributorAccountId: sourceId },
        data: { distributorAccountId: targetId }
      }),
      tx.revenueSchedule.updateMany({
        where: { tenantId, vendorAccountId: sourceId },
        data: { vendorAccountId: targetId }
      }),
      tx.depositLineItem.updateMany({
        where: { tenantId, vendorAccountId: sourceId },
        data: { vendorAccountId: targetId }
      }),
      tx.account.updateMany({
        where: { tenantId, parentAccountId: sourceId, id: { not: targetId } },
        data: { parentAccountId: targetId }
      }),
    ])

    // Mark the source as merged (and archived for safety).
    await tx.account.update({
      where: { id: sourceId },
      data: {
        mergedIntoAccountId: targetId,
        mergedAt: now,
        mergedById: userId,
        status: AccountStatus.Archived,
        updatedById: userId
      }
    })

    const audit = await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.Merge,
        entityName: "Account",
        entityId: targetId,
        metadata: JSON.stringify({
          sourceId,
          executedAt: now.toISOString(),
          fieldWinners,
          movedCounts,
          updates: {
            contactsMove: contactsMove.count,
            activitiesMove: activitiesMove.count,
            opportunitiesMove: opportunitiesMove.count,
            revenueSchedulesMove: revenueSchedulesMove.count,
            ticketsMove: ticketsMove.count,
            reconciliationsMove: reconciliationsMove.count,
            depositsMove: depositsMove.count,
            depositLineItemsMove: depositLineItemsMove.count,
            accountNotesMove: accountNotesMove.count,
            assignmentsMove: assignmentsMove.count,
            groupMembersMove: groupMembersMove.count,
            productsVendorMove: productsVendorMove.count,
            productsDistributorMove: productsDistributorMove.count,
            productsFlexMove: productsFlexMove.count,
            templatesDistributorMove: templatesDistributorMove.count,
            templatesVendorMove: templatesVendorMove.count,
            ticketsDistributorMove: ticketsDistributorMove.count,
            ticketsVendorMove: ticketsVendorMove.count,
            depositsDistributorMove: depositsDistributorMove.count,
            depositsVendorMove: depositsVendorMove.count,
            revenueSchedulesDistributorMove: revenueSchedulesDistributorMove.count,
            revenueSchedulesVendorMove: revenueSchedulesVendorMove.count,
            depositLineItemVendorMove: depositLineItemVendorMove.count,
            childAccountsMove: childAccountsMove.count
          }
        })
      }
    })

    return {
      ok: true,
      entity: "Account",
      targetId,
      sourceId,
      moved: movedCounts,
      auditLogId: audit.id
    }
  })
}

