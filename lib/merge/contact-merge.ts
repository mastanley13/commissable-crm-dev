import { AuditAction } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { MergeExecuteRequest, MergeExecuteResult, MergePreview, RelatedCount } from "./merge-types"
import { buildFieldConflicts, resolveMergedFieldValue } from "./merge-utils"

const CONTACT_MERGE_FIELDS = [
  "prefix",
  "suffix",
  "firstName",
  "middleName",
  "lastName",
  "jobTitle",
  "department",
  "contactType",
  "workPhone",
  "workPhoneExt",
  "mobilePhone",
  "otherPhone",
  "fax",
  "emailAddress",
  "alternateEmail",
  "preferredContactMethod",
  "isPrimary",
  "isDecisionMaker",
  "assistantName",
  "assistantPhone",
  "linkedinUrl",
  "websiteUrl",
  "birthdate",
  "anniversary",
  "description",
  "notes",
  "ownerId",
  "accountTypeId",
  "mailingAddressId",
  "syncAddressWithAccount",
  "reportsToContactId",
] as const

type ContactMergeField = (typeof CONTACT_MERGE_FIELDS)[number]

type ContactPreviewRecord = {
  id: string
  tenantId: string
  accountId: string
  firstName: string
  lastName: string
  fullName: string
  deletedAt: Date | null
  mergedIntoContactId: string | null
  mergedAt: Date | null
} & Record<ContactMergeField, unknown>

function mapContactPreviewFields(contact: ContactPreviewRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  for (const key of CONTACT_MERGE_FIELDS) {
    fields[key] = contact[key]
  }
  return fields
}

async function countContactMergeRelated(
  tenantId: string,
  sourceContactId: string
): Promise<RelatedCount[]> {
  const [
    activities,
    tickets,
    preferences,
    groupMembers,
    opportunityRoles,
    depositsCreated,
    templatesCreated,
  ] = await Promise.all([
    prisma.activity.count({ where: { tenantId, contactId: sourceContactId } }),
    prisma.ticket.count({ where: { tenantId, contactId: sourceContactId } }),
    prisma.contactPreference.count({ where: { tenantId, contactId: sourceContactId } }),
    prisma.groupMember.count({ where: { tenantId, contactId: sourceContactId } }),
    prisma.opportunityRole.count({ where: { tenantId, contactId: sourceContactId } }),
    prisma.deposit.count({ where: { tenantId, createdByContactId: sourceContactId } }),
    prisma.reconciliationTemplate.count({ where: { tenantId, createdByContactId: sourceContactId } }),
  ])

  return [
    { label: "Activities", count: activities },
    { label: "Tickets", count: tickets },
    { label: "Contact Preferences", count: preferences },
    { label: "Group Memberships", count: groupMembers },
    { label: "Opportunity Roles", count: opportunityRoles },
    { label: "Deposits Created", count: depositsCreated },
    { label: "Reconciliation Templates Created", count: templatesCreated },
  ].filter(entry => entry.count > 0)
}

export async function previewContactMerge(params: {
  tenantId: string
  targetId: string
  sourceId: string
}): Promise<MergePreview> {
  const { tenantId, targetId, sourceId } = params

  if (targetId === sourceId) {
    throw new Error("Target and source must be different records.")
  }

  const [target, source] = await Promise.all([
    prisma.contact.findFirst({
      where: { tenantId, id: targetId },
      select: Object.fromEntries(
        [
          "id",
          "tenantId",
          "accountId",
          "firstName",
          "lastName",
          "fullName",
          "deletedAt",
          "mergedIntoContactId",
          "mergedAt",
          ...CONTACT_MERGE_FIELDS,
        ].map(key => [key, true])
      ) as any
    }),
    prisma.contact.findFirst({
      where: { tenantId, id: sourceId },
      select: Object.fromEntries(
        [
          "id",
          "tenantId",
          "accountId",
          "firstName",
          "lastName",
          "fullName",
          "deletedAt",
          "mergedIntoContactId",
          "mergedAt",
          ...CONTACT_MERGE_FIELDS,
        ].map(key => [key, true])
      ) as any
    }),
  ])

  if (!target || !source) {
    throw new Error("Target or source record not found.")
  }

  const collisions: Array<{ type: string; message: string }> = []

  if (target.deletedAt) {
    collisions.push({ type: "target_deleted", message: "Target contact is deleted." })
  }
  if (source.deletedAt) {
    collisions.push({ type: "source_deleted", message: "Source contact is deleted." })
  }

  if (target.accountId !== source.accountId) {
    collisions.push({
      type: "different_accounts",
      message: "Contacts belong to different accounts. For MVP, contact merges must be within the same account."
    })
  }

  if (target.mergedIntoContactId) {
    collisions.push({
      type: "target_already_merged",
      message: "Target contact is already merged into another contact."
    })
  }

  if (source.mergedIntoContactId && source.mergedIntoContactId !== targetId) {
    collisions.push({
      type: "source_already_merged",
      message: "Source contact is already merged into another contact."
    })
  }

  const fieldConflicts = buildFieldConflicts(
    [...CONTACT_MERGE_FIELDS],
    target as Record<string, unknown>,
    source as Record<string, unknown>
  )

  const [relatedCounts, preferenceOverlap] = await Promise.all([
    countContactMergeRelated(tenantId, sourceId),
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "ContactPreference" s
      JOIN "ContactPreference" t
        ON s."channel" = t."channel"
     WHERE s."tenantId" = ${tenantId}
       AND t."tenantId" = ${tenantId}
       AND s."contactId" = ${sourceId}
       AND t."contactId" = ${targetId}
    `
  ])

  if (Number(preferenceOverlap?.[0]?.count ?? 0) > 0) {
    collisions.push({
      type: "contact_preference_overlap",
      message:
        "Both contacts have preferences for the same channel. The merge will keep target preferences and remove duplicates from source."
    })
  }

  return {
    entity: "Contact",
    target: {
      id: target.id,
      displayLabel: target.fullName,
      fields: mapContactPreviewFields(target as ContactPreviewRecord)
    },
    source: {
      id: source.id,
      displayLabel: source.fullName,
      fields: mapContactPreviewFields(source as ContactPreviewRecord)
    },
    fieldConflicts,
    relatedCounts,
    collisions
  }
}

export async function executeContactMerge(
  request: MergeExecuteRequest
): Promise<MergeExecuteResult> {
  const { tenantId, userId, targetId, sourceId, fieldWinners, dryRun } = request

  if (targetId === sourceId) {
    throw new Error("Target and source must be different records.")
  }

  const now = new Date()

  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Contact" WHERE id = ${targetId} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM "Contact" WHERE id = ${sourceId} FOR UPDATE`

    const [target, source] = await Promise.all([
      tx.contact.findFirst({
        where: { tenantId, id: targetId },
        select: Object.fromEntries(
          [
            "id",
            "tenantId",
            "accountId",
            "firstName",
            "lastName",
            "fullName",
            "deletedAt",
            "mergedIntoContactId",
            "mergedAt",
            ...CONTACT_MERGE_FIELDS,
          ].map(key => [key, true])
        ) as any
      }),
      tx.contact.findFirst({
        where: { tenantId, id: sourceId },
        select: Object.fromEntries(
          [
            "id",
            "tenantId",
            "accountId",
            "firstName",
            "lastName",
            "fullName",
            "deletedAt",
            "mergedIntoContactId",
            "mergedAt",
            ...CONTACT_MERGE_FIELDS,
          ].map(key => [key, true])
        ) as any
      }),
    ])

    if (!target || !source) {
      throw new Error("Target or source record not found.")
    }

    if (target.deletedAt || source.deletedAt) {
      throw new Error("Cannot merge deleted contacts.")
    }

    if (target.accountId !== source.accountId) {
      throw new Error("For MVP, contact merges must be within the same account.")
    }

    if (target.mergedIntoContactId) {
      throw new Error("Target contact is already merged into another contact.")
    }

    if (source.mergedIntoContactId && source.mergedIntoContactId !== targetId) {
      throw new Error("Source contact is already merged into another contact.")
    }

    const movedCounts = await (async () => {
      const [
        activities,
        tickets,
        preferences,
        groupMembers,
        opportunityRoles,
        depositsCreated,
        templatesCreated,
      ] = await Promise.all([
        tx.activity.count({ where: { tenantId, contactId: sourceId } }),
        tx.ticket.count({ where: { tenantId, contactId: sourceId } }),
        tx.contactPreference.count({ where: { tenantId, contactId: sourceId } }),
        tx.groupMember.count({ where: { tenantId, contactId: sourceId } }),
        tx.opportunityRole.count({ where: { tenantId, contactId: sourceId } }),
        tx.deposit.count({ where: { tenantId, createdByContactId: sourceId } }),
        tx.reconciliationTemplate.count({ where: { tenantId, createdByContactId: sourceId } }),
      ])

      return [
        { label: "Activities", count: activities },
        { label: "Tickets", count: tickets },
        { label: "Contact Preferences", count: preferences },
        { label: "Group Memberships", count: groupMembers },
        { label: "Opportunity Roles", count: opportunityRoles },
        { label: "Deposits Created", count: depositsCreated },
        { label: "Reconciliation Templates Created", count: templatesCreated },
      ].filter(entry => entry.count > 0)
    })()

    if (dryRun) {
      const audit = await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: AuditAction.Merge,
          entityName: "Contact",
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
        entity: "Contact",
        targetId,
        sourceId,
        moved: movedCounts,
        auditLogId: audit.id
      }
    }

    const updateTargetData: Record<string, unknown> = {}
    for (const key of CONTACT_MERGE_FIELDS) {
      updateTargetData[key] = resolveMergedFieldValue(
        key,
        target as Record<string, unknown>,
        source as Record<string, unknown>,
        fieldWinners
      )
    }

    const mergedFirstName = (updateTargetData.firstName as string | undefined) ?? target.firstName
    const mergedLastName = (updateTargetData.lastName as string | undefined) ?? target.lastName

    if (!mergedFirstName?.trim() || !mergedLastName?.trim()) {
      throw new Error("Contact First Name and Last Name cannot be empty.")
    }

    updateTargetData.fullName = `${mergedFirstName.trim()} ${mergedLastName.trim()}`

    // Prevent a self-loop if the target currently reports to the source.
    if (target.reportsToContactId === sourceId) {
      updateTargetData.reportsToContactId = source.reportsToContactId ?? null
    }

    await tx.contact.update({
      where: { id: targetId },
      data: {
        ...(updateTargetData as any),
        updatedById: userId
      }
    })

    // ContactPreference uniqueness: (contactId, channel)
    const sourcePreferences = await tx.contactPreference.findMany({
      where: { tenantId, contactId: sourceId },
      select: { id: true, channel: true, enabled: true, consentCapturedAt: true, consentCapturedById: true, notes: true }
    })

    if (sourcePreferences.length > 0) {
      const channels = sourcePreferences.map(pref => pref.channel)
      const targetPreferences = await tx.contactPreference.findMany({
        where: { tenantId, contactId: targetId, channel: { in: channels } },
        select: { id: true, channel: true, enabled: true, consentCapturedAt: true, consentCapturedById: true, notes: true }
      })

      const targetByChannel = new Map(targetPreferences.map(pref => [pref.channel, pref]))

      for (const pref of sourcePreferences) {
        const existing = targetByChannel.get(pref.channel)
        if (existing) {
          await tx.contactPreference.update({
            where: { id: existing.id },
            data: {
              enabled: existing.enabled ?? pref.enabled,
              consentCapturedAt: existing.consentCapturedAt ?? pref.consentCapturedAt,
              consentCapturedById: existing.consentCapturedById ?? pref.consentCapturedById,
              notes: (existing.notes && String(existing.notes).trim().length > 0) ? existing.notes : pref.notes
            }
          })
          await tx.contactPreference.delete({ where: { id: pref.id } })
          continue
        }

        await tx.contactPreference.update({
          where: { id: pref.id },
          data: { contactId: targetId }
        })
      }
    }

    // Resolve group membership uniqueness collisions by deleting duplicates on source.
    const sourceGroupMembers = await tx.groupMember.findMany({
      where: { tenantId, contactId: sourceId },
      select: { id: true, groupId: true, memberType: true }
    })

    if (sourceGroupMembers.length > 0) {
      const groupIds = Array.from(new Set(sourceGroupMembers.map(entry => entry.groupId)))
      const targetGroupMembers = await tx.groupMember.findMany({
        where: { tenantId, contactId: targetId, groupId: { in: groupIds } },
        select: { groupId: true, memberType: true }
      })

      const existingKeys = new Set(targetGroupMembers.map(entry => `${entry.groupId}:${entry.memberType}`))
      const duplicateIds = sourceGroupMembers
        .filter(entry => existingKeys.has(`${entry.groupId}:${entry.memberType}`))
        .map(entry => entry.id)

      if (duplicateIds.length > 0) {
        await tx.groupMember.deleteMany({ where: { id: { in: duplicateIds } } })
      }
    }

    const [
      activitiesMove,
      ticketsMove,
      opportunityRolesMove,
      groupMembersMove,
      depositsCreatedMove,
      templatesCreatedMove,
      directReportsMove,
    ] = await Promise.all([
      tx.activity.updateMany({ where: { tenantId, contactId: sourceId }, data: { contactId: targetId } }),
      tx.ticket.updateMany({ where: { tenantId, contactId: sourceId }, data: { contactId: targetId } }),
      tx.opportunityRole.updateMany({ where: { tenantId, contactId: sourceId }, data: { contactId: targetId } }),
      tx.groupMember.updateMany({ where: { tenantId, contactId: sourceId }, data: { contactId: targetId } }),
      tx.deposit.updateMany({ where: { tenantId, createdByContactId: sourceId }, data: { createdByContactId: targetId } }),
      tx.reconciliationTemplate.updateMany({
        where: { tenantId, createdByContactId: sourceId },
        data: { createdByContactId: targetId }
      }),
      tx.contact.updateMany({
        where: { tenantId, reportsToContactId: sourceId, id: { not: targetId } },
        data: { reportsToContactId: targetId }
      }),
    ])

    await tx.contact.update({
      where: { id: sourceId },
      data: {
        mergedIntoContactId: targetId,
        mergedAt: now,
        mergedById: userId,
        updatedById: userId
      }
    })

    const audit = await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.Merge,
        entityName: "Contact",
        entityId: targetId,
        metadata: JSON.stringify({
          sourceId,
          executedAt: now.toISOString(),
          fieldWinners,
          movedCounts,
          updates: {
            activitiesMove: activitiesMove.count,
            ticketsMove: ticketsMove.count,
            opportunityRolesMove: opportunityRolesMove.count,
            groupMembersMove: groupMembersMove.count,
            depositsCreatedMove: depositsCreatedMove.count,
            templatesCreatedMove: templatesCreatedMove.count,
            directReportsMove: directReportsMove.count,
          }
        })
      }
    })

    return {
      ok: true,
      entity: "Contact",
      targetId,
      sourceId,
      moved: movedCounts,
      auditLogId: audit.id
    }
  })
}

