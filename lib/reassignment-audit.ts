import { prisma } from "@/lib/db";
import { AuditAction } from "@prisma/client";

interface ReassignmentAuditData {
  accountId: string;
  previousOwnerId: string | null;
  newOwnerId: string;
  assignmentRole: string;
  effectiveDate: string;
  reassignedById: string;
  reason?: string;
  commissionTransfer: boolean;
  tenantId?: string;
  isBulkOperation?: boolean;
  accountCount?: number;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAccountReassignment(
  tx: any,
  data: ReassignmentAuditData
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: data.tenantId,
      userId: data.reassignedById,
      action: AuditAction.Update,
      entityName: 'ACCOUNT',
      entityId: data.accountId,

      // Detailed change information
      changedFields: ['ownerId', 'assignmentRole'],
      previousValues: {
        ownerId: data.previousOwnerId,
        assignmentRole: 'PreviousRole' // This could be enhanced to track previous role
      },
      newValues: {
        ownerId: data.newOwnerId,
        assignmentRole: data.assignmentRole
      },

      // Additional metadata
      metadata: {
        eventType: 'ACCOUNT_REASSIGNMENT',
        effectiveDate: data.effectiveDate,
        reason: data.reason,
        commissionTransfer: data.commissionTransfer,
        bulkOperation: data.isBulkOperation,
        accountCount: data.accountCount,
        targetOwner: data.newOwnerId,
        previousOwnerId: data.previousOwnerId,
        specialAssignment: data.newOwnerId === 'house' || data.newOwnerId === 'unassigned'
      },

      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      createdAt: new Date()
    }
  });
}

export async function logBulkAccountReassignment(
  tx: any,
  data: {
    accountIds: string[];
    newOwnerId: string;
    assignmentRole: string;
    effectiveDate: string;
    reassignedById: string;
    reason?: string;
    commissionTransfer: boolean;
    tenantId: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  const bulkOperationId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  for (const accountId of data.accountIds) {
    await logAccountReassignment(tx, {
      accountId,
      previousOwnerId: null, // Will be filled by the individual reassignment process
      newOwnerId: data.newOwnerId,
      assignmentRole: data.assignmentRole,
      effectiveDate: data.effectiveDate,
      reassignedById: data.reassignedById,
      reason: data.reason,
      commissionTransfer: data.commissionTransfer,
      tenantId: data.tenantId,
      isBulkOperation: true,
      accountCount: data.accountIds.length,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    });
  }

  await tx.auditLog.create({
    data: {
      tenantId: data.tenantId,
      userId: data.reassignedById,
      action: AuditAction.Update,
      entityName: 'BULK_OPERATION',
      entityId: bulkOperationId,

      changedFields: ['multiple_accounts'],
      previousValues: {},
      newValues: {
        accountCount: data.accountIds.length,
        targetOwner: data.newOwnerId,
        assignmentRole: data.assignmentRole
      },

      metadata: {
        eventType: 'BULK_ACCOUNT_REASSIGNMENT',
        operationType: 'bulk_reassignment',
        accountIds: data.accountIds,
        effectiveDate: data.effectiveDate,
        reason: data.reason,
        commissionTransfer: data.commissionTransfer
      },

      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      createdAt: new Date()
    }
  });
}

export async function getReassignmentHistory(
  accountId: string,
  tenantId: string,
  limit: number = 10
): Promise<any[]> {
  const history = await prisma.auditLog.findMany({
    where: {
      tenantId,
      entityName: 'ACCOUNT',
      entityId: accountId,
      action: AuditAction.Update,
      metadata: {
        path: ['eventType'],
        equals: 'ACCOUNT_REASSIGNMENT'
      }
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit
  });

  return history.map(entry => {
    const metadata = entry.metadata as Record<string, unknown> | null;
    const eventType = metadata?.eventType;

    return {
      id: entry.id,
      action: typeof eventType === 'string' ? eventType : entry.action,
      timestamp: entry.createdAt,
      performedBy: entry.user,
      previousValues: entry.previousValues,
      newValues: entry.newValues,
      metadata: entry.metadata
    };
  });
}

export async function getBulkReassignmentHistory(
  tenantId: string,
  limit: number = 20
): Promise<any[]> {
  const history = await prisma.auditLog.findMany({
    where: {
      tenantId,
      action: AuditAction.Update,
      metadata: {
        path: ['eventType'],
        equals: 'BULK_ACCOUNT_REASSIGNMENT'
      }
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit
  });

  return history.map(entry => {
    const metadata = entry.metadata as Record<string, unknown> | null;
    const eventType = metadata?.eventType;

    return {
      id: entry.id,
      action: typeof eventType === 'string' ? eventType : entry.action,
      timestamp: entry.createdAt,
      performedBy: entry.user,
      metadata: entry.metadata,
      entityId: entry.entityId // This will be the bulk operation ID
    };
  });
}

export async function getReassignmentAnalytics(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalReassignments: number;
  bulkReassignments: number;
  houseAssignments: number;
  unassignments: number;
  topReassignedAccounts: any[];
  reassignmentByUser: any[];
}> {
  const reassignments = await prisma.auditLog.findMany({
    where: {
      tenantId,
      action: AuditAction.Update,
      OR: [
        {
          metadata: {
            path: ['eventType'],
            equals: 'ACCOUNT_REASSIGNMENT'
          }
        },
        {
          metadata: {
            path: ['eventType'],
            equals: 'BULK_ACCOUNT_REASSIGNMENT'
          }
        }
      ],
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true
        }
      }
    }
  });

  const getMetadata = (entry: typeof reassignments[number]) =>
    (entry.metadata as Record<string, unknown> | null) ?? null;

  const getEventType = (entry: typeof reassignments[number]) => {
    const metadata = getMetadata(entry);
    const eventType = metadata?.eventType;
    return typeof eventType === 'string' ? eventType : undefined;
  };

  const getTargetOwner = (entry: typeof reassignments[number]) => {
    const metadata = getMetadata(entry);
    const targetOwner = metadata?.targetOwner;
    return typeof targetOwner === 'string' ? targetOwner : undefined;
  };

  const getNewValues = (entry: typeof reassignments[number]) =>
    (entry.newValues as Record<string, unknown> | null) ?? null;

  const getNewOwnerId = (entry: typeof reassignments[number]) => {
    const newValues = getNewValues(entry);
    const ownerId = newValues?.ownerId;
    if (typeof ownerId === 'string' || ownerId === null) {
      return ownerId;
    }
    return undefined;
  };

  const totalReassignments = reassignments.filter(
    entry => getEventType(entry) === 'ACCOUNT_REASSIGNMENT'
  ).length;

  const bulkReassignments = reassignments.filter(
    entry => getEventType(entry) === 'BULK_ACCOUNT_REASSIGNMENT'
  ).length;

  const houseAssignments = reassignments.filter(entry => {
    const targetOwner = getTargetOwner(entry);
    const ownerId = getNewOwnerId(entry);
    return targetOwner === 'house' || ownerId === 'house';
  }).length;

  const unassignments = reassignments.filter(entry => {
    const targetOwner = getTargetOwner(entry);
    const ownerId = getNewOwnerId(entry);
    return targetOwner === 'unassigned' || ownerId === null;
  }).length;

  const accountReassignmentCounts = reassignments
    .filter(entry => getEventType(entry) === 'ACCOUNT_REASSIGNMENT')
    .reduce((acc, entry) => {
      acc[entry.entityId] = (acc[entry.entityId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topReassignedAccounts = Object.entries(accountReassignmentCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([accountId, count]) => ({ accountId, count }));

  const reassignmentByUser = reassignments.reduce((acc, entry) => {
    const userId = entry.userId;
    if (typeof userId !== 'string' || userId.length === 0) {
      return acc;
    }
    const key = userId;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reassignmentByUserArray = Object.entries(reassignmentByUser)
    .map(([userId, count]) => ({
      userId,
      userName:
        reassignments.find(entry => entry.userId === userId)?.user?.fullName || 'Unknown',
      count
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalReassignments,
    bulkReassignments,
    houseAssignments,
    unassignments,
    topReassignedAccounts,
    reassignmentByUser: reassignmentByUserArray
  };
}

export async function createReassignmentReport(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  createdById: string
): Promise<string> {
  const analytics = await getReassignmentAnalytics(tenantId, startDate, endDate);

  // Persistence not yet implemented; return a serialized payload instead.
  return JSON.stringify({
    tenantId,
    createdById,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    analytics
  });
}

export async function logSpecialAssignment(
  tx: any,
  data: {
    accountId: string;
    specialUserId: string;
    assignmentRole: string;
    assignedById: string;
    tenantId: string;
    reason?: string;
  }
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: data.tenantId,
      userId: data.assignedById,
      action: AuditAction.Update,
      entityName: 'ACCOUNT',
      entityId: data.accountId,

      changedFields: ['ownerId', 'assignmentType'],
      previousValues: { ownerId: 'had_owner' },
      newValues: {
        ownerId: data.specialUserId,
        assignmentRole: data.assignmentRole,
        specialAssignment: true
      },

      metadata: {
        eventType: data.specialUserId === 'house' ? 'HOUSE_ASSIGNMENT' : 'ACCOUNT_UNASSIGNMENT',
        specialUserId: data.specialUserId,
        assignmentRole: data.assignmentRole,
        reason: data.reason
      },

      createdAt: new Date()
    }
  });
}












