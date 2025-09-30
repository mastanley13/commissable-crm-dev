import { prisma } from "@/lib/db";
import { applyReassignment, computeNewSplits, type CommissionStructure, type ReassignmentOptions } from "@/lib/commission-engine";
import { prorateSchedules } from "@/lib/commission-proration";

export interface BatchJob {
  batchId: string;
  scopeJson: any;
  strategyJson: any;
  createdById: string;
  tenantId: string;
}

export interface BatchProgress {
  batchId: string;
  totalOpportunities: number;
  processedOpportunities: number;
  successfulChanges: number;
  failedChanges: number;
  errors: string[];
  currentOpportunity?: string;
  estimatedTimeRemaining?: number;
}

/**
 * Processes a reassignment batch in the background
 */
export async function processReassignmentBatch(batchId: string): Promise<void> {
  // Get batch details
  const batch = await prisma.reassignmentBatch.findUnique({
    where: { id: batchId },
    include: { createdBy: true, tenant: true }
  });

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  if (batch.status !== 'PENDING') {
    throw new Error(`Batch ${batchId} is not in PENDING status`);
  }

  // Update batch status to RUNNING
  await prisma.reassignmentBatch.update({
    where: { id: batchId },
    data: {
      status: 'RUNNING',
      executedAt: new Date()
    }
  });

  try {
    const scope = batch.scopeJson as any;
    const strategy = batch.strategyJson as any;

    // Get opportunities based on scope
    const opportunities = await getOpportunitiesForScope(scope, batch.tenantId);

    const progress: BatchProgress = {
      batchId,
      totalOpportunities: opportunities.length,
      processedOpportunities: 0,
      successfulChanges: 0,
      failedChanges: 0,
      errors: []
    };

    // Process each opportunity
    for (const opportunity of opportunities) {
      progress.currentOpportunity = opportunity.id;
      progress.processedOpportunities++;

      try {
        await processOpportunityReassignment(opportunity, strategy, batchId, batch.createdById, batch.tenantId);
        progress.successfulChanges++;
      } catch (error) {
        progress.failedChanges++;
        progress.errors.push(`Opportunity ${opportunity.id}: ${error.message}`);
      }

      // Update progress (in a real implementation, you'd use a progress callback)
      await updateBatchProgress(batchId, progress);
    }

    // Mark batch as complete
    await prisma.reassignmentBatch.update({
      where: { id: batchId },
      data: {
        status: progress.failedChanges > 0 ? 'ERROR' : 'COMPLETE',
        errorJson: progress.errors.length > 0 ? { errors: progress.errors } : null
      }
    });

  } catch (error) {
    // Mark batch as error
    await prisma.reassignmentBatch.update({
      where: { id: batchId },
      data: {
        status: 'ERROR',
        errorJson: { error: error.message }
      }
    });

    throw error;
  }
}

/**
 * Gets opportunities based on batch scope
 */
async function getOpportunitiesForScope(scope: any, tenantId: string) {
  if (scope.accountIds) {
    // Account-level reassignment
    return await prisma.opportunity.findMany({
      where: {
        accountId: { in: scope.accountIds },
        tenantId
      },
      include: {
        account: true,
        revenueSchedules: true
      }
    });
  }

  if (scope.opportunityIds) {
    // Individual opportunity reassignment
    return await prisma.opportunity.findMany({
      where: {
        id: { in: scope.opportunityIds },
        tenantId
      },
      include: {
        account: true,
        revenueSchedules: true
      }
    });
  }

  throw new Error('Invalid scope configuration');
}

/**
 * Processes reassignment for a single opportunity
 */
async function processOpportunityReassignment(
  opportunity: any,
  strategy: any,
  batchId: string,
  createdById: string,
  tenantId: string
): Promise<void> {
  const currentStructure = opportunity.currentCommissionJson as CommissionStructure || {
    houseSplit: 0,
    splits: [],
    totalPercent: 0
  };

  // Apply strategy to compute new structure
  const options: ReassignmentOptions = {
    type: strategy.type,
    newRepId: strategy.newRepId,
    customSplits: strategy.customSplits,
    reason: strategy.reason
  };

  const result = computeNewSplits(currentStructure, options);

  if (!result.isValid) {
    throw new Error(`Invalid commission structure: ${result.errors.join(', ')}`);
  }

  // Apply reassignment
  await applyReassignment({
    opportunityId: opportunity.id,
    effectiveDate: new Date(strategy.effectiveDate),
    reason: strategy.reason,
    afterSplits: result.afterStructure,
    scope: 'L2', // Account level for batch processing
    batchId,
    triggeredById: createdById,
    tenantId
  });

  // Apply proration if cutoff date is specified
  if (strategy.cutoffDate) {
    await prorateSchedules({
      opportunityId: opportunity.id,
      cutoffDate: new Date(strategy.cutoffDate)
    });
  }
}

/**
 * Updates batch progress (placeholder for real-time updates)
 */
async function updateBatchProgress(batchId: string, progress: BatchProgress): Promise<void> {
  // In a real implementation, this would update a progress table or use WebSockets
  // For now, we'll just log the progress
  console.log(`Batch ${batchId} progress: ${progress.processedOpportunities}/${progress.totalOpportunities}`);
}

/**
 * Cancels a running batch
 */
export async function cancelReassignmentBatch(batchId: string): Promise<void> {
  const batch = await prisma.reassignmentBatch.findUnique({
    where: { id: batchId }
  });

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  if (batch.status !== 'RUNNING') {
    throw new Error(`Batch ${batchId} is not running`);
  }

  await prisma.reassignmentBatch.update({
    where: { id: batchId },
    data: {
      status: 'CANCELLED',
      errorJson: { cancelled: true, cancelledAt: new Date().toISOString() }
    }
  });
}

/**
 * Gets batch status and progress
 */
export async function getBatchStatus(batchId: string): Promise<BatchProgress | null> {
  const batch = await prisma.reassignmentBatch.findUnique({
    where: { id: batchId },
    include: {
      changes: true,
      createdBy: true
    }
  });

  if (!batch) {
    return null;
  }

  // Count changes by status (this would be more efficient with a separate progress table)
  const successfulChanges = batch.changes.length; // All created changes are successful
  const failedChanges = 0; // Would need error tracking

  return {
    batchId: batch.id,
    totalOpportunities: 0, // Would need to calculate from scope
    processedOpportunities: successfulChanges + failedChanges,
    successfulChanges,
    failedChanges,
    errors: batch.errorJson ? [batch.errorJson] : [],
    estimatedTimeRemaining: batch.status === 'RUNNING' ? 300 : undefined // 5 minutes estimate
  };
}
