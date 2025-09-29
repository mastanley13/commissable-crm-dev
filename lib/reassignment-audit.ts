import { prisma } from "@/lib/db";

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
      action: 'ACCOUNT_REASSIGNMENT',
      entityType: 'ACCOUNT',
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
        effectiveDate: data.effectiveDate,
        reason: data.reason,
        commissionTransfer: data.commissionTransfer,
        bulkOperation: data.isBulkOperation,
        accountCount: data.accountCount,
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
  // Create a bulk operation record
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

  // Log the bulk operation itself
  await tx.auditLog.create({
    data: {
      tenantId: data.tenantId,
      userId: data.reassignedById,
      action: 'BULK_ACCOUNT_REASSIGNMENT',
      entityType: 'BULK_OPERATION',
      entityId: bulkOperationId,

      changedFields: ['multiple_accounts'],
      previousValues: {},
      newValues: {
        accountCount: data.accountIds.length,
        targetOwner: data.newOwnerId,
        assignmentRole: data.assignmentRole
      },

      metadata: {
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
      entityType: 'ACCOUNT',
      entityId: accountId,
      action: 'ACCOUNT_REASSIGNMENT'
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

  return history.map(entry => ({
    id: entry.id,
    action: entry.action,
    timestamp: entry.createdAt,
    performedBy: entry.user,
    previousValues: entry.previousValues,
    newValues: entry.newValues,
    metadata: entry.metadata
  }));
}

export async function getBulkReassignmentHistory(
  tenantId: string,
  limit: number = 20
): Promise<any[]> {
  const history = await prisma.auditLog.findMany({
    where: {
      tenantId,
      action: 'BULK_ACCOUNT_REASSIGNMENT'
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

  return history.map(entry => ({
    id: entry.id,
    action: entry.action,
    timestamp: entry.createdAt,
    performedBy: entry.user,
    metadata: entry.metadata,
    entityId: entry.entityId // This will be the bulk operation ID
  }));
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
      action: { in: ['ACCOUNT_REASSIGNMENT', 'BULK_ACCOUNT_REASSIGNMENT'] },
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

  // Count different types of reassignments
  const totalReassignments = reassignments.filter(r => r.action === 'ACCOUNT_REASSIGNMENT').length;
  const bulkReassignments = reassignments.filter(r => r.action === 'BULK_ACCOUNT_REASSIGNMENT').length;

  const houseAssignments = reassignments.filter(r =>
    r.metadata?.targetOwner === 'house' || r.newValues?.ownerId === 'house'
  ).length;

  const unassignments = reassignments.filter(r =>
    r.metadata?.targetOwner === 'unassigned' || r.newValues?.ownerId === null
  ).length;

  // Get top reassigned accounts
  const accountReassignmentCounts = reassignments
    .filter(r => r.action === 'ACCOUNT_REASSIGNMENT')
    .reduce((acc, r) => {
      acc[r.entityId] = (acc[r.entityId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topReassignedAccounts = Object.entries(accountReassignmentCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([accountId, count]) => ({ accountId, count }));

  // Get reassignment count by user
  const reassignmentByUser = reassignments.reduce((acc, r) => {
    const userId = r.userId;
    acc[userId] = (acc[userId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reassignmentByUserArray = Object.entries(reassignmentByUser)
    .map(([userId, count]) => ({
      userId,
      userName: reassignments.find(r => r.userId === userId)?.user?.fullName || 'Unknown',
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

  // Create a report record
  const report = await prisma.report.create({
    data: {
      tenantId,
      name: `Account Reassignment Report ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      type: 'REASSIGNMENT_ANALYTICS',
      data: analytics,
      createdById,
      createdAt: new Date()
    }
  });

  return report.id;
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
      action: data.specialUserId === 'house' ? 'HOUSE_ASSIGNMENT' : 'ACCOUNT_UNASSIGNMENT',
      entityType: 'ACCOUNT',
      entityId: data.accountId,

      changedFields: ['ownerId', 'assignmentType'],
      previousValues: { ownerId: 'had_owner' },
      newValues: {
        ownerId: data.specialUserId,
        assignmentRole: data.assignmentRole,
        specialAssignment: true
      },

      metadata: {
        specialUserId: data.specialUserId,
        assignmentRole: data.assignmentRole,
        reason: data.reason
      },

      createdAt: new Date()
    }
  });
}
