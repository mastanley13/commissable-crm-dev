import { prisma } from "@/lib/db";

export interface CommissionImpact {
  totalAccounts: number;
  totalRevenueImpact: number;
  totalCommissionImpact: number;
  affectedRevenueSchedules: number;
  affectedOpportunities: number;
  transferDetails: Array<{
    currentOwnerId: string;
    currentOwnerName: string;
    accountCount: number;
    totalRevenue: number;
    totalCommission: number;
  }>;
  effectiveDate: string;
  newOwnerId: string;
}

export async function calculateCommissionImpact(
  accountIds: string[],
  newOwnerId: string,
  effectiveDate: string,
  transferCommissions: boolean
): Promise<CommissionImpact> {
  const effectiveDateObj = new Date(effectiveDate);

  // Get revenue schedules for affected accounts
  const revenueSchedules = await prisma.revenueSchedule.findMany({
    where: {
      accountId: { in: accountIds },
      scheduledDate: { gte: effectiveDateObj } // Future revenue only
    },
    include: {
      account: {
        include: {
          owner: true
        }
      },
      opportunity: true
    }
  });

  // Get opportunities for affected accounts
  const opportunities = await prisma.opportunity.findMany({
    where: {
      accountId: { in: accountIds },
      status: { in: ['Open', 'Won'] },
      expectedCloseDate: { gte: effectiveDateObj }
    },
    include: {
      account: {
        include: {
          owner: true
        }
      }
    }
  });

  // Calculate impact
  const totalRevenueImpact = revenueSchedules.reduce((sum, rs) => {
    return sum + (rs.projectedAmount || 0);
  }, 0);

  const totalCommissionImpact = opportunities.reduce((sum, opp) => {
    return sum + (opp.expectedCommission || 0);
  }, 0);

  // Group by current owners to show transfer details
  const currentOwnerMap = new Map<string, any>();

  // Process revenue schedules
  revenueSchedules.forEach(rs => {
    const ownerId = rs.account.ownerId || 'unassigned';
    const ownerName = rs.account.owner?.fullName || 'Unassigned';

    if (!currentOwnerMap.has(ownerId)) {
      currentOwnerMap.set(ownerId, {
        currentOwnerId: ownerId,
        currentOwnerName: ownerName,
        accountCount: new Set(),
        totalRevenue: 0,
        totalCommission: 0
      });
    }

    const ownerData = currentOwnerMap.get(ownerId)!;
    ownerData.accountCount.add(rs.accountId);
    ownerData.totalRevenue += rs.projectedAmount || 0;
  });

  // Process opportunities
  opportunities.forEach(opp => {
    const ownerId = opp.account.ownerId || 'unassigned';
    const ownerName = opp.account.owner?.fullName || 'Unassigned';

    if (!currentOwnerMap.has(ownerId)) {
      currentOwnerMap.set(ownerId, {
        currentOwnerId: ownerId,
        currentOwnerName: ownerName,
        accountCount: new Set(),
        totalRevenue: 0,
        totalCommission: 0
      });
    }

    const ownerData = currentOwnerMap.get(ownerId)!;
    ownerData.accountCount.add(opp.accountId);
    ownerData.totalCommission += opp.expectedCommission || 0;
  });

  const transferDetails = Array.from(currentOwnerMap.values()).map(ownerData => ({
    currentOwnerId: ownerData.currentOwnerId,
    currentOwnerName: ownerData.currentOwnerName,
    accountCount: ownerData.accountCount.size,
    totalRevenue: ownerData.totalRevenue,
    totalCommission: ownerData.totalCommission
  }));

  return {
    totalAccounts: accountIds.length,
    totalRevenueImpact,
    totalCommissionImpact,
    affectedRevenueSchedules: revenueSchedules.length,
    affectedOpportunities: opportunities.length,
    transferDetails,
    effectiveDate: effectiveDateObj.toISOString(),
    newOwnerId
  };
}

export async function calculateRevenueImpact(
  accountIds: string[],
  effectiveDate: Date,
  tenantId: string
): Promise<{
  totalAnnualRevenue: number;
  monthlyRecurring: number;
  oneTimeRevenue: number;
  affectedSchedules: number;
}> {
  const revenueSchedules = await prisma.revenueSchedule.findMany({
    where: {
      accountId: { in: accountIds },
      scheduledDate: { gte: effectiveDate },
      tenantId
    },
    include: {
      revenueType: true
    }
  });

  let totalAnnualRevenue = 0;
  let monthlyRecurring = 0;
  let oneTimeRevenue = 0;

  revenueSchedules.forEach(schedule => {
    const amount = schedule.projectedAmount || 0;
    totalAnnualRevenue += amount;

    // Categorize by revenue type
    if (schedule.revenueType?.name?.includes('MRC')) {
      monthlyRecurring += amount;
    } else if (schedule.revenueType?.name?.includes('NRC')) {
      oneTimeRevenue += amount;
    } else {
      totalAnnualRevenue += amount; // Default to annual
    }
  });

  return {
    totalAnnualRevenue,
    monthlyRecurring,
    oneTimeRevenue,
    affectedSchedules: revenueSchedules.length
  };
}

export async function calculateCommissionImpactFromOpportunities(
  accountIds: string[],
  effectiveDate: Date,
  tenantId: string
): Promise<{
  totalCommission: number;
  affectedOpportunities: number;
  averageCommissionRate: number;
}> {
  const opportunities = await prisma.opportunity.findMany({
    where: {
      accountId: { in: accountIds },
      expectedCloseDate: { gte: effectiveDate },
      status: { in: ['Open', 'Won'] },
      tenantId
    }
  });

  const totalCommission = opportunities.reduce((sum, opp) => {
    return sum + (opp.expectedCommission || 0);
  }, 0);

  const averageCommissionRate = opportunities.length > 0
    ? totalCommission / opportunities.reduce((sum, opp) => sum + (opp.expectedRevenue || 0), 0)
    : 0;

  return {
    totalCommission,
    affectedOpportunities: opportunities.length,
    averageCommissionRate
  };
}

export async function validateCommissionStructure(
  accountId: string,
  commissionStructure: any
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Commission structure validation rules
  const totalPercentage = commissionStructure.reduce((sum: number, split: any) => {
    return sum + (split.percentage || 0);
  }, 0);

  if (Math.abs(totalPercentage - 100) > 0.01) {
    errors.push('Commission percentages must total exactly 100%');
  }

  // Check for negative percentages
  const negativeSplits = commissionStructure.filter((split: any) => (split.percentage || 0) < 0);
  if (negativeSplits.length > 0) {
    errors.push('Commission percentages cannot be negative');
  }

  // Check for splits over 100%
  const overLimitSplits = commissionStructure.filter((split: any) => (split.percentage || 0) > 100);
  if (overLimitSplits.length > 0) {
    errors.push('Individual commission percentages cannot exceed 100%');
  }

  // Warnings for unusual splits
  const highPercentageSplits = commissionStructure.filter((split: any) => (split.percentage || 0) > 50);
  if (highPercentageSplits.length > 1) {
    warnings.push('Multiple commission splits over 50% detected');
  }

  const zeroSplits = commissionStructure.filter((split: any) => (split.percentage || 0) === 0);
  if (zeroSplits.length > 0) {
    warnings.push('Zero percentage commission splits detected');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
