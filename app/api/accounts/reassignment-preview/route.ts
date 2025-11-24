import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OpportunityStatus } from "@prisma/client";
import { OPEN_ACTIVITY_STATUSES, isActivityOpen } from "@/lib/activity-status";
import { isTaskType } from "@/lib/activity-type";
import { getCurrentUser } from "@/lib/api-auth";
import { hasPermission } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { user, tenantId } = await getCurrentUser();

    // Check permissions
    const hasReassignPermission = await hasPermission(user, 'accounts.reassign');
    const hasBulkPermission = await hasPermission(user, 'accounts.bulk');

    if (!hasReassignPermission || !hasBulkPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions for account reassignment' },
        { status: 403 }
      );
    }

    const { accountIds, newOwnerId, effectiveDate } = await request.json();

    // Validate input
    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { error: "Account IDs are required" },
        { status: 400 }
      );
    }

    if (!newOwnerId) {
      return NextResponse.json(
        { error: "New owner ID is required" },
        { status: 400 }
      );
    }

    if (!effectiveDate) {
      return NextResponse.json(
        { error: "Effective date is required" },
        { status: 400 }
      );
    }

    const effectiveDateObj = new Date(effectiveDate);
    if (isNaN(effectiveDateObj.getTime())) {
      return NextResponse.json(
        { error: "Invalid effective date format" },
        { status: 400 }
      );
    }

    // Calculate financial impact of reassignment
    const impactAnalysis = await calculateReassignmentImpact(
      accountIds,
      newOwnerId,
      effectiveDateObj,
      tenantId
    );

    return NextResponse.json(impactAnalysis);

  } catch (error) {
    console.error('Failed to calculate reassignment impact:', error);
    return NextResponse.json(
      { error: 'Failed to calculate impact' },
      { status: 500 }
    );
  }
}

interface ReassignmentImpact {
  totalAccounts: number;
  accountsByOwner: { [ownerId: string]: AccountSummary[] };

  // Financial Impact
  revenueImpact: {
    totalAnnualRevenue: number;
    monthlyRecurring: number;
    projectedCommissions: number;
    affectedOpportunities: number;
  };

  // Commission Changes
  commissionTransfers: {
    fromOwner: string;
    toOwner: string;
    amount: number;
    effectiveDate: string;
  }[];

  // Warnings/Validation
  warnings: string[];
  conflicts: string[];

  // Items to transfer (aggregated)
  itemCounts: {
    activeContacts: number;
    openActivities: number;
    activeGroups: number;
    openTasks: number;
  };
}

interface AccountSummary {
  id: string;
  accountName: string;
  currentOwnerId: string;
  currentOwnerName: string;
  accountType: string;
  status: string;
  totalRevenue: number;
  totalCommission: number;
  opportunityCount: number;
  revenueScheduleCount: number;
  activeContacts: number;
  openActivities: number;
  activeGroups: number;
  openTasks: number;
}

async function calculateReassignmentImpact(
  accountIds: string[],
  newOwnerId: string,
  effectiveDate: Date,
  tenantId: string
): Promise<ReassignmentImpact> {
  // Get accounts with current ownership
  const accounts = await prisma.account.findMany({
    where: {
      id: { in: accountIds },
      tenantId
    },
    include: {
      owner: true,
      accountType: { select: { name: true } },
      opportunities: {
        where: {
          status: { in: [OpportunityStatus.Open, OpportunityStatus.Won] },
          estimatedCloseDate: { gte: effectiveDate }
        }
      },
      revenueSchedules: {
        where: {
          scheduleDate: { gte: effectiveDate }
        }
      },
      contacts: true,
      activities: {
        where: { status: { in: OPEN_ACTIVITY_STATUSES as any } }
      },
      groupMembers: true
    }
  });

  // Group accounts by current owner
  const accountsByOwner: { [ownerId: string]: AccountSummary[] } = {};

  for (const account of accounts) {
    const ownerId = account.ownerId || 'unassigned';
    const ownerName = account.owner?.fullName || 'Unassigned';

    if (!accountsByOwner[ownerId]) {
      accountsByOwner[ownerId] = [];
    }

    const accountSummary: AccountSummary = {
      id: account.id,
      accountName: account.accountName,
      currentOwnerId: ownerId,
      currentOwnerName: ownerName,
      accountType: account.accountType?.name ?? "",
      status: account.status,
      totalRevenue: 0,
      totalCommission: account.opportunities.reduce((sum, opp) => sum + Number(opp.expectedCommission || 0), 0),
      opportunityCount: account.opportunities.length,
      revenueScheduleCount: account.revenueSchedules.length,
      activeContacts: account.contacts.length,
      openActivities: account.activities.length,
      activeGroups: account.groupMembers.length,
      openTasks: account.activities.filter(a => isTaskType(a.activityType as any) && isActivityOpen(a.status as any)).length
    };

    // Calculate revenue/commission from revenue schedules (expectedCommission)
    accountSummary.totalRevenue = account.revenueSchedules.reduce((sum, rs) => {
      return sum + Number(rs.expectedCommission || 0);
    }, 0);

    accountsByOwner[ownerId].push(accountSummary);
  }

  // Calculate total financial impact
  const totalAnnualRevenue = Object.values(accountsByOwner).flat().reduce((sum, account) => {
    return sum + account.totalRevenue;
  }, 0);

  const monthlyRecurring = Object.values(accountsByOwner).flat().reduce((sum, account) => {
    // Estimate monthly recurring as annual revenue divided by 12
    return sum + (account.totalRevenue / 12);
  }, 0);

  const projectedCommissions = Object.values(accountsByOwner).flat().reduce((sum, account) => {
    return sum + account.totalCommission;
  }, 0);

  const affectedOpportunities = Object.values(accountsByOwner).flat().reduce((sum, account) => {
    return sum + account.opportunityCount;
  }, 0);

  // Aggregate item counts
  const aggregatedCounts = Object.values(accountsByOwner).flat().reduce((acc, account) => {
    acc.activeContacts += account.activeContacts;
    acc.openActivities += account.openActivities;
    acc.activeGroups += account.activeGroups;
    acc.openTasks += account.openTasks;
    return acc;
  }, { activeContacts: 0, openActivities: 0, activeGroups: 0, openTasks: 0 });

  // Calculate commission transfers
  const commissionTransfers = Object.entries(accountsByOwner).map(([ownerId, ownerAccounts]) => {
    const totalCommission = ownerAccounts.reduce((sum, account) => sum + account.totalCommission, 0);

    return {
      fromOwner: ownerId,
      toOwner: newOwnerId,
      amount: totalCommission,
      effectiveDate: effectiveDate.toISOString()
    };
  }).filter(transfer => transfer.amount > 0);

  // Generate warnings and conflicts
  const warnings: string[] = [];
  const conflicts: string[] = [];

  // Check for potential issues
  if (newOwnerId === 'house') {
    warnings.push('Assigning to House Account may affect commission calculations');
  }

  if (newOwnerId === 'unassigned') {
    warnings.push('Removing ownership may affect account management and reporting');
  }

  // Check if any accounts are already assigned to the new owner
  const alreadyAssigned = Object.values(accountsByOwner).flat().filter(account =>
    account.currentOwnerId === newOwnerId
  );

  if (alreadyAssigned.length > 0) {
    warnings.push(`${alreadyAssigned.length} accounts are already assigned to the new owner`);
  }

  // Check for high-value accounts
  const highValueAccounts = Object.values(accountsByOwner).flat().filter(account =>
    account.totalRevenue > 100000 // $100K threshold
  );

  if (highValueAccounts.length > 0) {
    warnings.push(`${highValueAccounts.length} high-value accounts being reassigned`);
  }

  return {
    totalAccounts: accountIds.length,
    accountsByOwner,

    revenueImpact: {
      totalAnnualRevenue,
      monthlyRecurring,
      projectedCommissions,
      affectedOpportunities
    },

    commissionTransfers,

    warnings,
    conflicts,
    itemCounts: aggregatedCounts
  };
}
