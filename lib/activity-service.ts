import { ActivityStatus, ActivityType, ActivityEntityType, Prisma, AuditAction } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logActivityAudit } from '@/lib/audit'
import { triggerActivityCreated, triggerActivityStatusChanged } from '@/lib/workflows'
import { deleteStoredFile, saveActivityAttachment } from '@/lib/storage'

export interface ActivityListFilters {
  page?: number
  pageSize?: number
  search?: string
  type?: ActivityType
  status?: ActivityStatus
  includeCompleted?: boolean
  contextType?: ActivityEntityType
  contextId?: string
  sortBy?: 'dueDate' | 'createdAt'
  sortDirection?: 'asc' | 'desc'
}

export interface ActivityAttachmentSummary {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
  uploadedAt: Date
  uploadedByName: string
}

export interface ActivityListItem {
  id: string
  subject: string
  description: string | null
  dueDate: Date | null
  createdAt: Date
  updatedAt: Date
  status: ActivityStatus
  type: ActivityType
  accountId: string | null
  accountName: string | null
  contactId: string | null
  contactName: string | null
  opportunityId: string | null
  opportunityName: string | null
  revenueScheduleId: string | null
  revenueScheduleNumber: string | null
  assigneeId: string | null
  assigneeName: string | null
  creatorName: string
  updatedById: string | null
  updatedByName: string | null
  attachments: ActivityAttachmentSummary[]
  active: boolean
}

export interface ActivityDetail extends ActivityListItem {
  location: string | null
  links: Array<{ id: string; entityType: ActivityEntityType; entityId: string; isPrimary: boolean }>
}

export interface CreateActivityInput {
  tenantId: string
  userId: string
  subject: string
  type: ActivityType
  description?: string | null
  location?: string | null
  dueDate?: Date | null
  assigneeId?: string | null
  status?: ActivityStatus
  accountId?: string | null
  contactId?: string | null
  opportunityId?: string | null
  revenueScheduleId?: string | null
}

export interface UpdateActivityInput {
  activityId: string
  tenantId: string
  userId: string
  subject?: string
  type?: ActivityType
  description?: string | null
  location?: string | null
  dueDate?: Date | null
  assigneeId?: string | null
  status?: ActivityStatus
  accountId?: string | null
  contactId?: string | null
  opportunityId?: string | null
  revenueScheduleId?: string | null
}

export interface AttachmentUploadInput {
  tenantId: string
  activityId: string
  userId: string
  fileName: string
  mimeType: string
  buffer: Buffer
}

export interface ActivityReport {
  totals: {
    open: number
    completed: number
    overdue: number
  }
  byType: Array<{ type: ActivityType; count: number }>
  byStatus: Array<{ status: ActivityStatus; count: number }>
  byAssignee: Array<{ assigneeId: string | null; assigneeName: string | null; count: number }>
  trend: Array<{ day: string; created: number; completed: number }>
}

const ACTIVITY_INCLUDE = {
  account: { select: { id: true, accountName: true } },
  contact: { select: { id: true, fullName: true } },
  opportunity: { select: { id: true, name: true } },
  revenueSchedule: { select: { id: true, scheduleNumber: true } },
  assignee: { select: { id: true, fullName: true } },
  creator: { select: { id: true, fullName: true } },
  updater: { select: { id: true, fullName: true } },
  attachments: {
    include: {
      uploadedBy: { select: { fullName: true } }
    }
  },
  links: true
} satisfies Prisma.ActivityInclude

type ActivityWithRelations = Prisma.ActivityGetPayload<{ include: typeof ACTIVITY_INCLUDE }>

function mapAttachment(attachment: ActivityWithRelations['attachments'][number]): ActivityAttachmentSummary {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType,
    uploadedAt: attachment.uploadedAt,
    uploadedByName: attachment.uploadedBy?.fullName ?? 'Unknown'
  }
}

function mapActivity(activity: ActivityWithRelations): ActivityDetail {
  return {
    id: activity.id,
    subject: activity.subject,
    description: activity.description ?? null,
    dueDate: activity.dueDate,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
    status: activity.status,
    type: activity.activityType,
    accountId: activity.accountId,
    accountName: activity.account?.accountName ?? null,
    contactId: activity.contactId,
    contactName: activity.contact?.fullName ?? null,
    opportunityId: activity.opportunityId,
    opportunityName: activity.opportunity?.name ?? null,
    revenueScheduleId: activity.revenueScheduleId,
    revenueScheduleNumber: activity.revenueSchedule?.scheduleNumber ?? null,
    assigneeId: activity.assigneeId,
    assigneeName: activity.assignee?.fullName ?? null,
    creatorName: activity.creator?.fullName ?? 'System',
    updatedById: activity.updatedById,
    updatedByName: activity.updater?.fullName ?? null,
    attachments: activity.attachments.map(mapAttachment),
    active: activity.status === ActivityStatus.Open,
    location: activity.location ?? null,
    links: activity.links.map(link => ({
      id: link.id,
      entityType: link.entityType,
      entityId: link.entityId,
      isPrimary: link.isPrimary
    }))
  }
}

function toListItem(activity: ActivityWithRelations): ActivityListItem {
  const detail = mapActivity(activity)
  const { location, links, ...rest } = detail
  return rest
}

export async function listActivities(tenantId: string, filters: ActivityListFilters = {}): Promise<{ data: ActivityListItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const page = filters.page && filters.page > 0 ? filters.page : 1
  const pageSize = filters.pageSize && filters.pageSize > 0 ? Math.min(filters.pageSize, 100) : 25

  const where: Prisma.ActivityWhereInput = { tenantId }

  if (!filters.includeCompleted) {
    where.status = ActivityStatus.Open
  } else if (filters.status) {
    where.status = filters.status
  }

  if (filters.type) {
    where.activityType = filters.type
  }

  if (filters.search) {
    const query = filters.search.trim()
    if (query.length > 0) {
      where.OR = [
        { subject: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { account: { accountName: { contains: query, mode: 'insensitive' } } },
        { contact: { fullName: { contains: query, mode: 'insensitive' } } },
        { opportunity: { name: { contains: query, mode: 'insensitive' } } }
      ]
    }
  }

  if (filters.contextType && filters.contextId) {
    where.links = {
      some: {
        entityType: filters.contextType,
        entityId: filters.contextId
      }
    }
  }

  const orderByField = filters.sortBy === 'createdAt' ? 'createdAt' : 'dueDate'
  const orderDirection = filters.sortDirection ?? 'desc'

  const [total, activities] = await prisma.$transaction([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      include: ACTIVITY_INCLUDE,
      orderBy: { [orderByField]: orderDirection },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    data: activities.map(toListItem),
    pagination: {
      page,
      pageSize,
      total,
      totalPages
    }
  }
}

async function resolveContextLinks(tenantId: string, context: { accountId?: string | null; contactId?: string | null; opportunityId?: string | null; revenueScheduleId?: string | null }) {
  const links: Array<{ entityType: ActivityEntityType; entityId: string; isPrimary: boolean }> = []
  const seen = new Set<string>()

  async function addLink(entityType: ActivityEntityType, entityId: string, isPrimary = false) {
    const key = `${entityType}:${entityId}`
    if (!entityId || seen.has(key)) return
    seen.add(key)
    links.push({ entityType, entityId, isPrimary })
  }

  if (context.accountId) {
    const account = await prisma.account.findFirst({ where: { id: context.accountId, tenantId }, select: { id: true } })
    if (account) {
      await addLink(ActivityEntityType.Account, account.id, true)
    }
  }

  if (context.contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: context.contactId, tenantId }, select: { id: true, accountId: true } })
    if (contact) {
      await addLink(ActivityEntityType.Contact, contact.id, !links.some(link => link.isPrimary))
      if (contact.accountId) {
        await addLink(ActivityEntityType.Account, contact.accountId)
      }
    }
  }

  if (context.opportunityId) {
    const opportunity = await prisma.opportunity.findFirst({ where: { id: context.opportunityId, tenantId }, select: { id: true, accountId: true } })
    if (opportunity) {
      await addLink(ActivityEntityType.Opportunity, opportunity.id, !links.some(link => link.isPrimary))
      if (opportunity.accountId) {
        await addLink(ActivityEntityType.Account, opportunity.accountId)
      }
    }
  }

  if (context.revenueScheduleId) {
    const schedule = await prisma.revenueSchedule.findFirst({ where: { id: context.revenueScheduleId, tenantId }, select: { id: true, accountId: true } })
    if (schedule) {
      await addLink(ActivityEntityType.RevenueSchedule, schedule.id, !links.some(link => link.isPrimary))
      if (schedule.accountId) {
        await addLink(ActivityEntityType.Account, schedule.accountId)
      }
    }
  }

  return links
}

export async function createActivity(input: CreateActivityInput): Promise<ActivityDetail> {
  const {
    tenantId,
    userId,
    subject,
    type,
    description = null,
    location = null,
    dueDate = null,
    assigneeId = null,
    status = ActivityStatus.Open,
    accountId = null,
    contactId = null,
    opportunityId = null,
    revenueScheduleId = null
  } = input

  const links = await resolveContextLinks(tenantId, { accountId, contactId, opportunityId, revenueScheduleId })

  const activity = await prisma.$transaction(async tx => {
    const created = await tx.activity.create({
      data: {
        tenantId,
        creatorId: userId,
        assigneeId,
        activityType: type,
        subject,
        description,
        location,
        dueDate,
        status,
        completedAt: status === ActivityStatus.Completed ? new Date() : null,
        accountId,
        contactId,
        opportunityId,
        revenueScheduleId
      }
    })

    if (links.length > 0) {
      await tx.activityLink.createMany({
        data: links.map(link => ({
          tenantId,
          activityId: created.id,
          entityType: link.entityType,
          entityId: link.entityId,
          isPrimary: link.isPrimary
        }))
      })
    }

    return tx.activity.findUniqueOrThrow({ where: { id: created.id }, include: ACTIVITY_INCLUDE })
  })

  await logActivityAudit(
    AuditAction.Create,
    activity.id,
    userId,
    tenantId,
    undefined,
    undefined,
    mapActivity(activity)
  )

  await triggerActivityCreated({ activity, tenantId, userId })

  return mapActivity(activity)
}

export async function getActivityById(activityId: string, tenantId: string): Promise<ActivityDetail | null> {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, tenantId }, include: ACTIVITY_INCLUDE })
  return activity ? mapActivity(activity) : null
}

export async function updateActivity(input: UpdateActivityInput): Promise<ActivityDetail> {
  const existing = await prisma.activity.findFirst({ where: { id: input.activityId, tenantId: input.tenantId }, include: ACTIVITY_INCLUDE })
  if (!existing) {
    throw new Error('Activity not found')
  }

  const links = await resolveContextLinks(input.tenantId, {
    accountId: input.accountId ?? existing.accountId,
    contactId: input.contactId ?? existing.contactId,
    opportunityId: input.opportunityId ?? existing.opportunityId,
    revenueScheduleId: input.revenueScheduleId ?? existing.revenueScheduleId
  })

  const updated = await prisma.$transaction(async tx => {
    const nextStatus = input.status ?? existing.status
    const activity = await tx.activity.update({
      where: { id: input.activityId },
      data: {
        subject: input.subject ?? existing.subject,
        activityType: input.type ?? existing.activityType,
        description: input.description ?? existing.description,
        location: input.location ?? existing.location,
        dueDate: input.dueDate ?? existing.dueDate,
        assigneeId: input.assigneeId ?? existing.assigneeId,
        status: nextStatus,
        completedAt: nextStatus === ActivityStatus.Completed ? (existing.completedAt ?? new Date()) : null,
        accountId: input.accountId ?? existing.accountId,
        contactId: input.contactId ?? existing.contactId,
        opportunityId: input.opportunityId ?? existing.opportunityId,
        revenueScheduleId: input.revenueScheduleId ?? existing.revenueScheduleId,
        updatedById: input.userId
      }
    })

    await tx.activityLink.deleteMany({ where: { activityId: activity.id } })
    if (links.length > 0) {
      await tx.activityLink.createMany({
        data: links.map(link => ({
          tenantId: input.tenantId,
          activityId: activity.id,
          entityType: link.entityType,
          entityId: link.entityId,
          isPrimary: link.isPrimary
        }))
      })
    }

    return tx.activity.findUniqueOrThrow({ where: { id: activity.id }, include: ACTIVITY_INCLUDE })
  })

  const detail = mapActivity(updated)

  await logActivityAudit(
    AuditAction.Update,
    input.activityId,
    input.userId,
    input.tenantId,
    mapActivity(existing),
    detail
  )

  if ((input.status ?? existing.status) !== existing.status) {
    await triggerActivityStatusChanged({
      activity: updated,
      tenantId: input.tenantId,
      userId: input.userId,
      previousStatus: existing.status,
      currentStatus: input.status ?? existing.status
    })
  }

  return detail
}

export async function deleteActivity(activityId: string, tenantId: string, userId: string): Promise<void> {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, tenantId }, include: ACTIVITY_INCLUDE })
  if (!activity) {
    throw new Error('Activity not found')
  }

  await prisma.$transaction(async tx => {
    await tx.activityAttachment.deleteMany({ where: { activityId } })
    await tx.activityLink.deleteMany({ where: { activityId } })
    await tx.activity.delete({ where: { id: activityId } })
  })

  for (const attachment of activity.attachments) {
    await deleteStoredFile(attachment.storageKey)
  }

  await logActivityAudit(
    AuditAction.Delete,
    activityId,
    userId,
    tenantId,
    mapActivity(activity),
    undefined
  )
}

export async function uploadActivityAttachment(input: AttachmentUploadInput): Promise<ActivityAttachmentSummary> {
  const activity = await prisma.activity.findFirst({ where: { id: input.activityId, tenantId: input.tenantId } })
  if (!activity) {
    throw new Error('Activity not found')
  }

  const saved = await saveActivityAttachment({
    tenantId: input.tenantId,
    activityId: input.activityId,
    originalName: input.fileName,
    mimeType: input.mimeType,
    buffer: input.buffer
  })

  const attachment = await prisma.activityAttachment.create({
    data: {
      tenantId: input.tenantId,
      activityId: input.activityId,
      fileName: saved.fileName,
      fileSize: saved.fileSize,
      mimeType: saved.mimeType,
      storageKey: saved.storageKey,
      uploadedById: input.userId
    },
    include: {
      uploadedBy: { select: { fullName: true } }
    }
  })

  await logActivityAudit(
    AuditAction.Update,
    input.activityId,
    input.userId,
    input.tenantId,
    undefined,
    { attachment: attachment.fileName }
  )

  return mapAttachment(attachment)
}

export async function removeActivityAttachment(attachmentId: string, tenantId: string, userId: string): Promise<void> {
  const attachment = await prisma.activityAttachment.findFirst({ where: { id: attachmentId, tenantId } })
  if (!attachment) {
    throw new Error('Attachment not found')
  }

  await prisma.activityAttachment.delete({ where: { id: attachmentId } })
  await deleteStoredFile(attachment.storageKey)

  await logActivityAudit(
    AuditAction.Update,
    attachment.activityId,
    userId,
    tenantId,
    undefined,
    { removedAttachment: attachment.fileName }
  )
}

export async function listActivityAttachments(activityId: string, tenantId: string): Promise<ActivityAttachmentSummary[]> {
  const attachments = await prisma.activityAttachment.findMany({
    where: { activityId, tenantId },
    include: { uploadedBy: { select: { fullName: true } } },
    orderBy: { uploadedAt: 'desc' }
  })

  return attachments.map(mapAttachment)
}

export async function getActivityAttachment(attachmentId: string, tenantId: string) {
  return prisma.activityAttachment.findFirst({
    where: { id: attachmentId, tenantId },
    include: { activity: { select: { id: true } }, uploadedBy: { select: { fullName: true } } }
  })
}

export async function getActivityReport(tenantId: string): Promise<ActivityReport> {
  const now = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 13)
  start.setHours(0, 0, 0, 0)

  const [openCount, completedCount, overdueCount, byTypeRows, byStatusRows, byAssigneeRows] = await Promise.all([
    prisma.activity.count({ where: { tenantId, status: ActivityStatus.Open } }),
    prisma.activity.count({ where: { tenantId, status: ActivityStatus.Completed } }),
    prisma.activity.count({ where: { tenantId, status: ActivityStatus.Open, dueDate: { lt: now } } }),
    prisma.activity.groupBy({ where: { tenantId }, by: ['activityType'], _count: { _all: true } }),
    prisma.activity.groupBy({ where: { tenantId }, by: ['status'], _count: { _all: true } }),
    prisma.activity.groupBy({ where: { tenantId }, by: ['assigneeId'], _count: { _all: true } })
  ])

  const assigneeIds = byAssigneeRows.map(row => row.assigneeId).filter((value): value is string => Boolean(value))

  const assignees = assigneeIds.length > 0
    ? await prisma.user.findMany({ where: { tenantId, id: { in: assigneeIds } }, select: { id: true, fullName: true } })
    : []

  const createdTrend = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::bigint AS count
    FROM "Activity"
    WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${start}
    GROUP BY 1
    ORDER BY 1
  `

  const completedTrend = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT DATE_TRUNC('day', "completedAt") AS day, COUNT(*)::bigint AS count
    FROM "Activity"
    WHERE "tenantId" = ${tenantId} AND "completedAt" IS NOT NULL AND "completedAt" >= ${start}
    GROUP BY 1
    ORDER BY 1
  `

  const trendMap = new Map<string, { created: number; completed: number }>()
  for (let i = 0; i < 14; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    const key = day.toISOString().split('T')[0]
    trendMap.set(key, { created: 0, completed: 0 })
  }

  createdTrend.forEach(row => {
    const key = row.day.toISOString().split('T')[0]
    const entry = trendMap.get(key)
    if (entry) entry.created = Number(row.count)
  })

  completedTrend.forEach(row => {
    const key = row.day.toISOString().split('T')[0]
    const entry = trendMap.get(key)
    if (entry) entry.completed = Number(row.count)
  })

  return {
    totals: {
      open: openCount,
      completed: completedCount,
      overdue: overdueCount
    },
    byType: byTypeRows.map(row => ({ type: row.activityType, count: row._count._all })),
    byStatus: byStatusRows.map(row => ({ status: row.status, count: row._count._all })),
    byAssignee: byAssigneeRows.map(row => {
      const assignee = assignees.find(a => a.id === row.assigneeId)
      return {
        assigneeId: row.assigneeId,
        assigneeName: assignee?.fullName ?? (row.assigneeId ? 'Former User' : 'Unassigned'),
        count: row._count._all
      }
    }),
    trend: Array.from(trendMap.entries()).map(([day, counts]) => ({ day, created: counts.created, completed: counts.completed }))
  }
}
