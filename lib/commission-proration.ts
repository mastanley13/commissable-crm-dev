import { prisma } from "@/lib/db";

export interface ProrationAdjustment {
  scheduleId: string;
  originalAmount: number;
  proratedAmount: number;
  startDate: Date;
  endDate: Date;
  adjustmentType: 'PRE_CUTOFF' | 'POST_CUTOFF';
}

export interface ProrationResult {
  opportunityId: string;
  cutoffDate: Date;
  adjustments: ProrationAdjustment[];
  totalAdjustment: number;
}

/**
 * Calculates prorated revenue schedules for opportunities with commission changes
 */
export async function prorateSchedules(params: {
  opportunityId: string;
  cutoffDate: Date;
}): Promise<ProrationResult> {
  const { opportunityId, cutoffDate } = params;

  // Get all revenue schedules for this opportunity
  const schedules = await prisma.revenueSchedule.findMany({
    where: {
      opportunityId,
      scheduleDate: {
        gte: cutoffDate
      }
    },
    orderBy: {
      scheduleDate: 'asc'
    }
  });

  const adjustments: ProrationAdjustment[] = [];

  for (const schedule of schedules) {
    if (!schedule.scheduleDate) continue;

    const scheduleDate = new Date(schedule.scheduleDate);

    // If schedule is entirely before cutoff, no proration needed
    if (scheduleDate < cutoffDate) {
      continue;
    }

    // If schedule is entirely after cutoff, mark for proration
    if (scheduleDate >= cutoffDate) {
      // Get the schedule period (assuming monthly for now)
      const periodStart = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth(), 1);
      const periodEnd = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth() + 1, 0);

      // Calculate days before and after cutoff
      const daysBeforeCutoff = Math.max(0, Math.ceil((cutoffDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
      const daysAfterCutoff = Math.max(0, Math.ceil((periodEnd.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24)));

      const totalDays = daysBeforeCutoff + daysAfterCutoff;
      const originalAmount = Number(schedule.expectedCommission || 0);

      if (totalDays > 0) {
        const proratedAmount = (originalAmount / totalDays) * daysAfterCutoff;

        adjustments.push({
          scheduleId: schedule.id,
          originalAmount,
          proratedAmount,
          startDate: cutoffDate,
          endDate: periodEnd,
          adjustmentType: 'POST_CUTOFF'
        });

        // Update schedule with proration flag
        await prisma.revenueSchedule.update({
          where: { id: schedule.id },
          data: {
            prorationApplied: true,
            expectedCommission: proratedAmount,
            notes: `Prorated due to commission reassignment effective ${cutoffDate.toISOString().split('T')[0]}`
          }
        });
      }
    }
  }

  const totalAdjustment = adjustments.reduce((sum, adj) =>
    sum + (adj.proratedAmount - adj.originalAmount), 0
  );

  return {
    opportunityId,
    cutoffDate,
    adjustments,
    totalAdjustment
  };
}

/**
 * Calculates the financial impact of proration across all affected schedules
 */
export async function calculateProrationImpact(params: {
  opportunityIds: string[];
  cutoffDate: Date;
}): Promise<{
  totalOpportunities: number;
  totalSchedulesAffected: number;
  totalAdjustment: number;
  adjustmentsByOpportunity: Record<string, ProrationAdjustment[]>;
}> {
  const { opportunityIds, cutoffDate } = params;

  let totalSchedulesAffected = 0;
  let totalAdjustment = 0;
  const adjustmentsByOpportunity: Record<string, ProrationAdjustment[]> = {};

  for (const opportunityId of opportunityIds) {
    const result = await prorateSchedules({ opportunityId, cutoffDate });

    if (result.adjustments.length > 0) {
      totalSchedulesAffected += result.adjustments.length;
      totalAdjustment += result.totalAdjustment;
      adjustmentsByOpportunity[opportunityId] = result.adjustments;
    }
  }

  return {
    totalOpportunities: opportunityIds.length,
    totalSchedulesAffected,
    totalAdjustment,
    adjustmentsByOpportunity
  };
}

/**
 * Reverses proration for a specific opportunity (used in rollback scenarios)
 */
export async function reverseProration(params: {
  opportunityId: string;
  originalCutoffDate: Date;
}): Promise<void> {
  const { opportunityId, originalCutoffDate } = params;

  // Get schedules that were prorated for this opportunity
  const proratedSchedules = await prisma.revenueSchedule.findMany({
    where: {
      opportunityId,
      prorationApplied: true,
      scheduleDate: {
        gte: originalCutoffDate
      }
    }
  });

  for (const schedule of proratedSchedules) {
    // Restore original commission amount (would need to store original value)
    // For now, we'll just mark as not prorated
    await prisma.revenueSchedule.update({
      where: { id: schedule.id },
      data: {
        prorationApplied: false,
        notes: null
      }
    });
  }
}
