import { prisma } from "@/lib/db";

export interface CommissionSplit {
  contactId: string;
  splitPercent: number;
}

export interface CommissionStructure {
  houseSplit: number;
  splits: CommissionSplit[];
  totalPercent: number;
}

export interface ReassignmentOptions {
  type: 'HOUSE_ABSORB' | 'DIRECT_TRANSFER' | 'CUSTOM';
  newRepId?: string;
  customSplits?: CommissionSplit[];
  reason?: string;
}

export interface ReassignmentResult {
  beforeStructure: CommissionStructure;
  afterStructure: CommissionStructure;
  changes: CommissionSplit[];
  isValid: boolean;
  errors: string[];
}

/**
 * Computes the new commission splits based on reassignment type and options
 */
export function computeNewSplits(
  currentStructure: CommissionStructure,
  options: ReassignmentOptions
): ReassignmentResult {
  const errors: string[] = [];

  // Validate current structure totals 100%
  if (Math.abs(currentStructure.totalPercent - 100) > 0.01) {
    errors.push('Current commission structure does not total 100%');
  }

  let afterStructure = { ...currentStructure };
  const changes: CommissionSplit[] = [];

  switch (options.type) {
    case 'HOUSE_ABSORB':
      afterStructure = applyHouseAbsorption(currentStructure);
      break;

    case 'DIRECT_TRANSFER':
      if (!options.newRepId) {
        errors.push('New representative ID required for direct transfer');
        break;
      }
      afterStructure = applyDirectTransfer(currentStructure, options.newRepId);
      break;

    case 'CUSTOM':
      if (!options.customSplits) {
        errors.push('Custom splits required for custom reassignment');
        break;
      }
      afterStructure = applyCustomRedistribution(currentStructure, options.customSplits);
      break;

    default:
      errors.push('Invalid reassignment type');
  }

  // Validate final structure
  if (Math.abs(afterStructure.totalPercent - 100) > 0.01) {
    errors.push('Final commission structure does not total 100%');
  }

  return {
    beforeStructure: currentStructure,
    afterStructure,
    changes,
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates that commission splits total exactly 100%
 */
export function validateSplits(splits: CommissionSplit[]): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const totalPercent = splits.reduce((sum, split) => sum + split.splitPercent, 0);

  if (Math.abs(totalPercent - 100) > 0.01) {
    issues.push(`Commission splits total ${totalPercent}% but must equal 100%`);
  }

  const negativeSplits = splits.filter(split => split.splitPercent < 0);
  if (negativeSplits.length > 0) {
    issues.push('Commission percentages cannot be negative');
  }

  const overLimitSplits = splits.filter(split => split.splitPercent > 100);
  if (overLimitSplits.length > 0) {
    issues.push('Individual commission percentages cannot exceed 100%');
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

/**
 * Applies reassignment and creates audit record
 */
export async function applyReassignment(params: {
  opportunityId: string;
  effectiveDate: Date;
  reason?: string;
  afterSplits: CommissionStructure;
  scope: 'L1' | 'L2' | 'L3';
  batchId?: string;
  triggeredById: string;
  tenantId: string;
}): Promise<void> {
  const { opportunityId, effectiveDate, reason, afterSplits, scope, batchId, triggeredById, tenantId } = params;

  // Get current opportunity
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { tenant: true }
  });

  if (!opportunity) {
    throw new Error('Opportunity not found');
  }

  // Get current commission structure
  const currentJson = (opportunity as any).currentCommissionJson as any;
  const currentStructure: CommissionStructure = currentJson || {
    houseSplit: 0,
    splits: [],
    totalPercent: 0
  };

  // Create audit record
  await (prisma as any).commissionChange.create({
    data: {
      tenantId,
      opportunityId,
      scope,
      effectiveDate,
      type: mapStructureToType(afterSplits),
      beforeJson: currentStructure,
      afterJson: afterSplits,
      reason: reason || 'Commission reassignment',
      triggeredById,
      batchId,
    }
  });

  // Update opportunity
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      currentCommissionJson: afterSplits,
      commissionStatus: 'REASSIGNED',
      updatedAt: new Date()
    } as any
  });
}

/**
 * Maps commission structure to reassignment type
 */
function mapStructureToType(structure: CommissionStructure): 'HOUSE_ABSORB' | 'DIRECT_TRANSFER' | 'CUSTOM' {
  // Simple heuristic - in a real implementation, you'd store the type with the structure
  if (structure.houseSplit >= 100) {
    return 'HOUSE_ABSORB';
  }
  if (structure.splits.length === 1) {
    return 'DIRECT_TRANSFER';
  }
  return 'CUSTOM';
}

/**
 * Applies house absorption logic
 */
function applyHouseAbsorption(current: CommissionStructure): CommissionStructure {
  return {
    houseSplit: 100,
    splits: [],
    totalPercent: 100
  };
}

/**
 * Applies direct transfer logic
 */
function applyDirectTransfer(current: CommissionStructure, newRepId: string): CommissionStructure {
  // Find the highest percentage rep (excluding house)
  const repSplits = current.splits.filter(split => split.contactId !== 'house');
  if (repSplits.length === 0) {
    throw new Error('No representative splits found to transfer');
  }

  const maxSplit = repSplits.reduce((max, split) =>
    split.splitPercent > max.splitPercent ? split : max
  );

  return {
    houseSplit: current.houseSplit,
    splits: [
      { contactId: newRepId, splitPercent: maxSplit.splitPercent }
    ],
    totalPercent: 100
  };
}

/**
 * Applies custom redistribution logic
 */
function applyCustomRedistribution(current: CommissionStructure, customSplits: CommissionSplit[]): CommissionStructure {
  // Validate custom splits
  const validation = validateSplits(customSplits);
  if (!validation.ok) {
    throw new Error(`Invalid custom splits: ${validation.issues.join(', ')}`);
  }

  return {
    houseSplit: 100 - customSplits.reduce((sum, split) => sum + split.splitPercent, 0),
    splits: customSplits,
    totalPercent: 100
  };
}
