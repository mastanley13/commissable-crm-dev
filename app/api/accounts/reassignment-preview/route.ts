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
    fromOwnerName: string;
    toOwnerName: string;
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

  portfolioSummary: PortfolioSummary;
  transferSummary: TransferSummary;
  transferAssociations: TransferAssociations;
}

interface PortfolioSummary {
  revenueAndContracts: {
    totalAnnualRevenue: number;
    monthlyRecurring: number;
    activeContracts: number;
    revenueScheduleCount: number;
    nextRenewalDate: string | null;
  };
  pipeline: {
    openOpportunities: number;
    pipelineValue: number;
    stageBreakdown: Record<string, number>;
    nextCloseDate: string | null;
  };
  health: {
    highRiskAccounts: number;
    overdueTasks: number;
    staleAccounts: number;
    avgDaysSinceActivity: number | null;
  };
  ownerImpact: OwnerImpactSummary;
}

interface OwnerImpactSummary {
  ownerId: string;
  ownerName: string;
  ownerType: 'user' | 'house' | 'unassigned';
  currentBookSize: number | null;
  incomingAccounts: number;
  resultingBookSize: number | null;
  additionalRevenue: number;
  additionalPipeline: number;
}

interface TransferSummary {
  willMove: {
    accounts: number;
    contacts: number;
    openOpportunities: number;
    revenueSchedules: number;
    openTasks: number;
  };
  willRemain: {
    closedOpportunities: number;
    completedTasks: number;
    historicalRevenueSchedules: number;
  };
  exceptions: string[];
}

interface TransferAssociations {
  revenueSchedules: TransferRevenueSchedule[];
  contacts: TransferContact[];
  opportunities: TransferOpportunity[];
  groups: TransferGroup[];
  products: TransferProduct[];
}

interface TransferRevenueSchedule {
  id: string;
  accountId: string;
  accountName: string;
  scheduleNumber: string | null;
  scheduleDate: string | null;
  status: string;
  amount: number | null;
  productName: string | null;
  opportunityName: string | null;
}

interface TransferContact {
  id: string;
  accountId: string;
  accountName: string;
  fullName: string;
  jobTitle: string | null;
  email: string | null;
}

interface TransferOpportunity {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  stage: string;
  estimatedCloseDate: string | null;
  amount: number | null;
}

interface TransferGroup {
  id: string;
  accountId: string;
  accountName: string;
  groupName: string;
  memberType: string;
}

interface TransferProduct {
  id: string;
  accountId: string;
  accountName: string;
  opportunityName: string;
  productName: string;
  quantity: number | null;
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
        },
        include: {
          products: {
            include: {
              product: {
                select: {
                  productNameHouse: true,
                  productNameVendor: true,
                  productCode: true
                }
              }
            }
          }
        }
      },
      revenueSchedules: {
        where: {
          scheduleDate: { gte: effectiveDate }
        },
        include: {
          product: {
            select: {
              productNameHouse: true,
              productNameVendor: true,
              productCode: true
            }
          },
          opportunity: {
            select: {
              name: true
            }
          }
        }
      },
      contacts: true,
      activities: {
        select: {
          id: true,
          activityType: true,
          status: true,
          dueDate: true,
          completedAt: true,
          updatedAt: true,
          createdAt: true,
          startDate: true,
          endDate: true
        }
      },
      groupMembers: {
        include: {
          group: true
        }
      }
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

    const openActivities = account.activities.filter(a => isActivityOpen(a.status as any));
    const openTasks = openActivities.filter(a => isTaskType(a.activityType as any));

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
      openActivities: openActivities.length,
      activeGroups: account.groupMembers.length,
      openTasks: openTasks.length
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

  const now = new Date();
  const dayInMs = 1000 * 60 * 60 * 24;
  const staleThreshold = new Date(now.getTime() - 30 * dayInMs);
  const riskThreshold = new Date(now.getTime() - 45 * dayInMs);
  let highRiskAccounts = 0;
  let overdueTasks = 0;
  let staleAccounts = 0;
  let activityAgeAccumulator = 0;
  let accountsWithActivity = 0;
  let completedTaskCount = 0;
  const stageBreakdown: Record<string, number> = {};
  let totalPipelineValue = 0;
  let openOpportunityCount = 0;
  let nextCloseDate: Date | null = null;
  const allRevenueSchedules: Array<(typeof accounts)[number]["revenueSchedules"][number]> = [];

  for (const account of accounts) {
    account.revenueSchedules.forEach(schedule => allRevenueSchedules.push(schedule));

    const openActivitiesForAccount = account.activities.filter(a => isActivityOpen(a.status as any));
    const openTasksForAccount = openActivitiesForAccount.filter(a => isTaskType(a.activityType as any));
    const overdueForAccount = openTasksForAccount.filter(task => task.dueDate && task.dueDate < now);
    overdueTasks += overdueForAccount.length;

    const completedTasksForAccount = account.activities.filter(
      a => isTaskType(a.activityType as any) && !isActivityOpen(a.status as any)
    );
    completedTaskCount += completedTasksForAccount.length;

    const lastActivityDate = account.activities.reduce<Date | null>((latest, activity) => {
      const candidate =
        activity.updatedAt ||
        activity.completedAt ||
        activity.endDate ||
        activity.startDate ||
        activity.dueDate ||
        activity.createdAt;
      if (!candidate) return latest;
      if (!latest || candidate > latest) {
        return candidate;
      }
      return latest;
    }, null);

    if (!lastActivityDate || lastActivityDate < staleThreshold) {
      staleAccounts++;
    }

    if (lastActivityDate) {
      accountsWithActivity++;
      activityAgeAccumulator += (now.getTime() - lastActivityDate.getTime()) / dayInMs;
    }

    const isInactiveStatus = account.status !== 'Active';
    const isAging = !lastActivityDate || lastActivityDate < riskThreshold;
    if (isInactiveStatus || overdueForAccount.length > 0 || isAging) {
      highRiskAccounts++;
    }

    for (const opportunity of account.opportunities) {
      const amount = Number(opportunity.amount || 0);
      if (opportunity.status === OpportunityStatus.Open) {
        openOpportunityCount++;
        totalPipelineValue += amount;
        const stageKey = String(opportunity.stage);
        stageBreakdown[stageKey] = (stageBreakdown[stageKey] || 0) + 1;
        if (opportunity.estimatedCloseDate) {
          if (!nextCloseDate || opportunity.estimatedCloseDate < nextCloseDate) {
            nextCloseDate = opportunity.estimatedCloseDate;
          }
        }
      }
    }
  }

  const activeRevenueSchedules = allRevenueSchedules.filter(schedule => schedule.status !== 'Cancelled');
  const upcomingRenewalDates = activeRevenueSchedules
    .map(schedule => schedule.scheduleDate)
    .filter((date): date is Date => !!date && date >= now)
    .sort((a, b) => a.getTime() - b.getTime());
  const nextRenewalDate = upcomingRenewalDates.length > 0 ? upcomingRenewalDates[0] : null;
  const activeContractKeys = new Set<string>();
  activeRevenueSchedules.forEach(schedule => {
    const key = schedule.opportunityId || `${schedule.accountId}:${schedule.id}`;
    activeContractKeys.add(key);
  });

  const [historicalRevenueCount, closedOpportunityCount] = await Promise.all([
    prisma.revenueSchedule.count({
      where: {
        tenantId,
        accountId: { in: accountIds },
        scheduleDate: { lt: effectiveDate }
      }
    }),
    prisma.opportunity.count({
      where: {
        tenantId,
        accountId: { in: accountIds },
        status: { in: [OpportunityStatus.Won, OpportunityStatus.Lost, OpportunityStatus.OnHold] }
      }
    })
  ]);

  const ownerImpact = await buildOwnerImpactSummary({
    tenantId,
    newOwnerId,
    additionalAccounts: accountIds.length,
    additionalRevenue: totalAnnualRevenue,
    pipelineValue: totalPipelineValue
  });

  const portfolioSummary: PortfolioSummary = {
    revenueAndContracts: {
      totalAnnualRevenue,
      monthlyRecurring,
      activeContracts: activeContractKeys.size,
      revenueScheduleCount: activeRevenueSchedules.length,
      nextRenewalDate: nextRenewalDate ? nextRenewalDate.toISOString() : null
    },
    pipeline: {
      openOpportunities: openOpportunityCount,
      pipelineValue: totalPipelineValue,
      stageBreakdown,
      nextCloseDate: nextCloseDate ? nextCloseDate.toISOString() : null
    },
    health: {
      highRiskAccounts,
      overdueTasks,
      staleAccounts,
      avgDaysSinceActivity:
        accountsWithActivity > 0 ? Number((activityAgeAccumulator / accountsWithActivity).toFixed(1)) : null
    },
    ownerImpact
  };

  const exceptions: string[] = [];
  if (closedOpportunityCount > 0) {
    exceptions.push(`${closedOpportunityCount} closed opportunities stay attributed to the previous owner.`);
  }
  if (historicalRevenueCount > 0) {
    exceptions.push(`${historicalRevenueCount} historical revenue schedules remain untouched.`);
  }
  if (completedTaskCount > 0) {
    exceptions.push(`${completedTaskCount} completed tasks remain with the originating reps.`);
  }

  const transferSummary: TransferSummary = {
    willMove: {
      accounts: accountIds.length,
      contacts: aggregatedCounts.activeContacts,
      openOpportunities: openOpportunityCount,
      revenueSchedules: activeRevenueSchedules.length,
      openTasks: aggregatedCounts.openTasks
    },
    willRemain: {
      closedOpportunities: closedOpportunityCount,
      completedTasks: completedTaskCount,
      historicalRevenueSchedules: historicalRevenueCount
    },
    exceptions
  };

  const revenueScheduleTransfers: TransferRevenueSchedule[] = accounts.flatMap(account =>
    account.revenueSchedules.map(schedule => ({
      id: schedule.id,
      accountId: account.id,
      accountName: account.accountName,
      scheduleNumber: schedule.scheduleNumber || null,
      scheduleDate: schedule.scheduleDate ? schedule.scheduleDate.toISOString() : null,
      status: schedule.status,
      amount: schedule.expectedCommission ? Number(schedule.expectedCommission) : null,
      productName: schedule.product?.productNameHouse
        ?? schedule.product?.productNameVendor
        ?? schedule.product?.productCode
        ?? null,
      opportunityName: schedule.opportunity?.name ?? null
    }))
  );

  const contactTransfers: TransferContact[] = accounts.flatMap(account =>
    account.contacts.map(contact => ({
      id: contact.id,
      accountId: account.id,
      accountName: account.accountName,
      fullName: contact.fullName,
      jobTitle: contact.jobTitle ?? null,
      email: contact.emailAddress ?? null
    }))
  );

  const opportunityTransfers: TransferOpportunity[] = accounts.flatMap(account =>
    account.opportunities.map(opportunity => ({
      id: opportunity.id,
      accountId: account.id,
      accountName: account.accountName,
      name: opportunity.name,
      stage: String(opportunity.stage),
      estimatedCloseDate: opportunity.estimatedCloseDate ? opportunity.estimatedCloseDate.toISOString() : null,
      amount: opportunity.amount ? Number(opportunity.amount) : null
    }))
  );

  const groupTransfers: TransferGroup[] = accounts.flatMap(account =>
    account.groupMembers.map(member => ({
      id: member.id,
      accountId: account.id,
      accountName: account.accountName,
      groupName: member.group?.name ?? 'Untitled group',
      memberType: String(member.memberType)
    }))
  );

  const productTransfers: TransferProduct[] = accounts.flatMap(account =>
    account.opportunities.flatMap(opportunity =>
      (opportunity.products || []).map(product => ({
        id: product.id,
        accountId: account.id,
        accountName: account.accountName,
        opportunityName: opportunity.name,
        productName: product.product?.productNameHouse
          ?? product.product?.productNameVendor
          ?? product.product?.productCode
          ?? 'Unnamed product',
        quantity: product.quantity ? Number(product.quantity) : null
      }))
    )
  );

  const transferAssociations: TransferAssociations = {
    revenueSchedules: revenueScheduleTransfers,
    contacts: contactTransfers,
    opportunities: opportunityTransfers,
    groups: groupTransfers,
    products: productTransfers
  };

  // Calculate commission transfers
  const commissionTransfers = Object.entries(accountsByOwner).map(([ownerId, ownerAccounts]) => {
    const totalCommission = ownerAccounts.reduce((sum, account) => sum + account.totalCommission, 0);
    const ownerName = ownerAccounts[0]?.currentOwnerName || (ownerId === 'unassigned' ? 'Unassigned' : 'Unknown Owner');

    return {
      fromOwner: ownerId,
      toOwner: newOwnerId,
      amount: totalCommission,
      effectiveDate: effectiveDate.toISOString(),
      fromOwnerName: ownerName,
      toOwnerName: ownerImpact.ownerName
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
    itemCounts: aggregatedCounts,
    portfolioSummary,
    transferSummary,
    transferAssociations
  };
}

interface OwnerImpactInput {
  tenantId: string;
  newOwnerId: string;
  additionalAccounts: number;
  additionalRevenue: number;
  pipelineValue: number;
}

async function buildOwnerImpactSummary({
  tenantId,
  newOwnerId,
  additionalAccounts,
  additionalRevenue,
  pipelineValue
}: OwnerImpactInput): Promise<OwnerImpactSummary> {
  let ownerName = 'Unknown Owner';
  let ownerType: OwnerImpactSummary['ownerType'] = 'user';
  let currentBookSize: number | null = null;

  if (newOwnerId === 'house') {
    ownerType = 'house';
    ownerName = 'House Account';
    currentBookSize = await prisma.account.count({
      where: { tenantId, ownerId: null }
    });
  } else if (newOwnerId === 'unassigned') {
    ownerType = 'unassigned';
    ownerName = 'Unassigned Queue';
    currentBookSize = await prisma.account.count({
      where: { tenantId, ownerId: null }
    });
  } else {
    const owner = await prisma.user.findFirst({
      where: { id: newOwnerId, tenantId },
      select: { fullName: true }
    });
    ownerName = owner?.fullName ?? 'Unknown User';
    currentBookSize = await prisma.account.count({
      where: { tenantId, ownerId: newOwnerId }
    });
  }

  const resultingBookSize = currentBookSize !== null ? currentBookSize + additionalAccounts : null;

  return {
    ownerId: newOwnerId,
    ownerName,
    ownerType,
    currentBookSize,
    incomingAccounts: additionalAccounts,
    resultingBookSize,
    additionalRevenue,
    additionalPipeline: pipelineValue
  };
}
