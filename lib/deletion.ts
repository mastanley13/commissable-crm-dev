import { prisma } from '@/lib/db'
import { AccountStatus, UserStatus, AuditAction, RevenueScheduleStatus } from '@prisma/client'

// Types for deletion system
export interface DeletionConstraint {
  entity: string
  field: string
  count: number
  message: string
}

export interface DeletionResult {
  success: boolean
  stage: 'soft' | 'permanent'
  constraints?: DeletionConstraint[]
  error?: string
}

export interface EntityRelationshipCheck {
  entity: string
  checkFunction: (tenantId: string, entityId: string) => Promise<DeletionConstraint[]>
}

type PermanentDependencyCount = { singular: string; plural: string; count: number }

function formatPermanentDependencySummary(dependencies: PermanentDependencyCount[]): string {
  if (!dependencies || dependencies.length === 0) return ''

  const sorted = [...dependencies]
    .filter(dep => dep.count > 0)
    .sort((a, b) => b.count - a.count || a.plural.localeCompare(b.plural))

  const top = sorted.slice(0, 4)
  const remainder = sorted.length - top.length

  const formatted = top
    .map(dep => `${dep.count} ${dep.count === 1 ? dep.singular : dep.plural}`)
    .join(', ')

  return remainder > 0 ? `${formatted}, and ${remainder} more` : formatted
}

async function getAccountPermanentDeleteDependencies(tenantId: string, accountId: string): Promise<PermanentDependencyCount[]> {
  const [
    childAccounts,
    contacts,
    opportunities,
    accountAssignments,
    accountNotes,
    groupMembers,
    activities,
    reconciliations,
    ticketsAccount,
    ticketsDistributor,
    ticketsVendor,
    revenueSchedulesAccount,
    revenueSchedulesDistributor,
    revenueSchedulesVendor,
    depositsAccount,
    depositsDistributor,
    depositsVendor,
    depositLineItemsAccount,
    depositLineItemsVendor,
    productsDistributor,
    productsVendor,
    reconciliationTemplatesDistributor,
    reconciliationTemplatesVendor,
  ] = await Promise.all([
    prisma.account.count({ where: { tenantId, parentAccountId: accountId } }),
    prisma.contact.count({ where: { tenantId, accountId } }),
    prisma.opportunity.count({ where: { tenantId, accountId } }),
    prisma.accountAssignment.count({ where: { tenantId, accountId } }),
    prisma.accountNote.count({ where: { tenantId, accountId } }),
    prisma.groupMember.count({ where: { tenantId, accountId } }),
    prisma.activity.count({ where: { tenantId, accountId } }),
    prisma.reconciliation.count({ where: { tenantId, accountId } }),
    prisma.ticket.count({ where: { tenantId, accountId } }),
    prisma.ticket.count({ where: { tenantId, distributorAccountId: accountId } }),
    prisma.ticket.count({ where: { tenantId, vendorAccountId: accountId } }),
    prisma.revenueSchedule.count({ where: { tenantId, accountId } }),
    prisma.revenueSchedule.count({ where: { tenantId, distributorAccountId: accountId } }),
    prisma.revenueSchedule.count({ where: { tenantId, vendorAccountId: accountId } }),
    prisma.deposit.count({ where: { tenantId, accountId } }),
    prisma.deposit.count({ where: { tenantId, distributorAccountId: accountId } }),
    prisma.deposit.count({ where: { tenantId, vendorAccountId: accountId } }),
    prisma.depositLineItem.count({ where: { tenantId, accountId } }),
    prisma.depositLineItem.count({ where: { tenantId, vendorAccountId: accountId } }),
    prisma.product.count({ where: { tenantId, distributorAccountId: accountId } }),
    prisma.product.count({ where: { tenantId, vendorAccountId: accountId } }),
    prisma.reconciliationTemplate.count({ where: { tenantId, distributorAccountId: accountId } }),
    prisma.reconciliationTemplate.count({ where: { tenantId, vendorAccountId: accountId } }),
  ])

  return [
    { singular: 'child account', plural: 'child accounts', count: childAccounts },
    { singular: 'contact', plural: 'contacts', count: contacts },
    { singular: 'opportunity', plural: 'opportunities', count: opportunities },
    { singular: 'account assignment', plural: 'account assignments', count: accountAssignments },
    { singular: 'account note', plural: 'account notes', count: accountNotes },
    { singular: 'group membership', plural: 'group memberships', count: groupMembers },
    { singular: 'activity', plural: 'activities', count: activities },
    { singular: 'reconciliation', plural: 'reconciliations', count: reconciliations },
    { singular: 'ticket', plural: 'tickets', count: ticketsAccount },
    { singular: 'ticket (as distributor)', plural: 'tickets (as distributor)', count: ticketsDistributor },
    { singular: 'ticket (as vendor)', plural: 'tickets (as vendor)', count: ticketsVendor },
    { singular: 'revenue schedule', plural: 'revenue schedules', count: revenueSchedulesAccount },
    { singular: 'revenue schedule (as distributor)', plural: 'revenue schedules (as distributor)', count: revenueSchedulesDistributor },
    { singular: 'revenue schedule (as vendor)', plural: 'revenue schedules (as vendor)', count: revenueSchedulesVendor },
    { singular: 'deposit', plural: 'deposits', count: depositsAccount },
    { singular: 'deposit (as distributor)', plural: 'deposits (as distributor)', count: depositsDistributor },
    { singular: 'deposit (as vendor)', plural: 'deposits (as vendor)', count: depositsVendor },
    { singular: 'deposit line item', plural: 'deposit line items', count: depositLineItemsAccount },
    { singular: 'deposit line item (as vendor)', plural: 'deposit line items (as vendor)', count: depositLineItemsVendor },
    { singular: 'product (as distributor)', plural: 'products (as distributor)', count: productsDistributor },
    { singular: 'product (as vendor)', plural: 'products (as vendor)', count: productsVendor },
    { singular: 'reconciliation template (as distributor)', plural: 'reconciliation templates (as distributor)', count: reconciliationTemplatesDistributor },
    { singular: 'reconciliation template (as vendor)', plural: 'reconciliation templates (as vendor)', count: reconciliationTemplatesVendor },
  ].filter(dep => dep.count > 0)
}

// Entity status mappings for soft deletion
export const EntityStatusMappings = {
  Account: {
    model: 'account',
    statusField: 'status',
    activeStatus: AccountStatus.Active,
    inactiveStatus: AccountStatus.Inactive,
    deletedStatus: AccountStatus.Archived
  },
  User: {
    model: 'user',
    statusField: 'status', 
    activeStatus: UserStatus.Active,
    inactiveStatus: UserStatus.Suspended,
    deletedStatus: UserStatus.Disabled
  },
  // For entities without built-in status fields, we'll add deletedAt timestamps
  Contact: {
    model: 'contact',
    statusField: 'deletedAt',
    activeStatus: null,
    inactiveStatus: new Date(),
    deletedStatus: new Date()
  },
  Opportunity: {
    model: 'opportunity', 
    statusField: 'deletedAt',
    activeStatus: null,
    inactiveStatus: new Date(),
    deletedStatus: new Date()
  },
  Product: {
    model: 'product',
    statusField: 'isActive',
    activeStatus: true,
    inactiveStatus: false,
    deletedStatus: false
  },
  Ticket: {
    model: 'ticket',
    statusField: 'deletedAt', 
    activeStatus: null,
    inactiveStatus: new Date(),
    deletedStatus: new Date()
  },
  Group: {
    model: 'group',
    statusField: 'deletedAt',
    activeStatus: null,
    inactiveStatus: new Date(),
    deletedStatus: new Date()
  }
} as const

// Relationship constraint checks
export const RelationshipChecks: Record<string, EntityRelationshipCheck> = {
  Account: {
    entity: 'Account',
    checkFunction: async (tenantId: string, accountId: string): Promise<DeletionConstraint[]> => {
      const constraints: DeletionConstraint[] = []

      // Check for active contacts  
      const contactCount = await prisma.contact.count({
        where: { 
          tenantId, 
          accountId,
          deletedAt: null
        }
      })

      if (contactCount > 0) {
        constraints.push({
          entity: 'Contacts',
          field: 'accountId',
          count: contactCount,
          message: `Cannot delete account with ${contactCount} active contact(s). Please delete or reassign contacts first.`
        })
      }

      // Check for open opportunities
      const opportunityCount = await prisma.opportunity.count({
        where: { 
          tenantId, 
          accountId,
          status: { in: ['Open', 'OnHold'] }
          // Note: deletedAt field not yet added to schema
        }
      })

      if (opportunityCount > 0) {
        constraints.push({
          entity: 'Opportunities',
          field: 'accountId', 
          count: opportunityCount,
          message: `Cannot delete account with ${opportunityCount} open opportunit(ies). Please close or reassign opportunities first.`
        })
      }

      // Check for opportunities in billing (Won status)
      const billingOpportunityCount = await prisma.opportunity.count({
        where: {
          tenantId,
          accountId,
          status: 'Won'
          // Note: deletedAt field not yet added to schema
        }
      })

      if (billingOpportunityCount > 0) {
        constraints.push({
          entity: 'Billing Opportunities',
          field: 'accountId',
          count: billingOpportunityCount,
          message: `Cannot delete account with ${billingOpportunityCount} opportunit(ies) in billing status. Please complete billing process first.`
        })
      }

      // Check for child accounts
      const childAccountCount = await prisma.account.count({
        where: { 
          tenantId, 
          parentAccountId: accountId,
          status: { not: AccountStatus.Archived }
        }
      })

      if (childAccountCount > 0) {
        constraints.push({
          entity: 'Child Accounts',
          field: 'parentAccountId',
          count: childAccountCount,
          message: `Cannot delete account with ${childAccountCount} child account(s). Please delete or reassign child accounts first.`
        })
      }

      // Check for active revenue schedules
      const revenueScheduleCount = await prisma.revenueSchedule.count({
        where: {
          tenantId,
          accountId,
          deletedAt: null,
          status: { in: [RevenueScheduleStatus.Unreconciled, RevenueScheduleStatus.Underpaid, RevenueScheduleStatus.Overpaid] }
        }
      })

      if (revenueScheduleCount > 0) {
        constraints.push({
          entity: 'Revenue Schedules',
          field: 'accountId',
          count: revenueScheduleCount,
          message: `Cannot delete account with ${revenueScheduleCount} active revenue schedule(s). Please complete or cancel revenue schedules first.`
        })
      }

      return constraints
    }
  },

  Contact: {
    entity: 'Contact',
    checkFunction: async (tenantId: string, contactId: string): Promise<DeletionConstraint[]> => {
      const constraints: DeletionConstraint[] = []

      // Check for direct reports
      const directReportCount = await prisma.contact.count({
        where: { 
          tenantId, 
          reportsToContactId: contactId,
          deletedAt: null
        }
      })

      if (directReportCount > 0) {
        constraints.push({
          entity: 'Direct Reports',
          field: 'reportsToContactId',
          count: directReportCount,
          message: `Cannot delete contact with ${directReportCount} direct report(s). Please reassign reporting relationships first.`
        })
      }

      // Check for open activities
      const activityCount = await prisma.activity.count({
        where: {
          tenantId,
          contactId,
          status: { in: ['Open'] }
        }
      })

      if (activityCount > 0) {
        constraints.push({
          entity: 'Activities',
          field: 'contactId',
          count: activityCount,
          message: `Contact has ${activityCount} open activit(ies). These will be orphaned if contact is deleted.`
        })
      }

      return constraints
    }
  },

  User: {
    entity: 'User',
    checkFunction: async (tenantId: string, userId: string): Promise<DeletionConstraint[]> => {
      const constraints: DeletionConstraint[] = []

      // Check for owned accounts
      const ownedAccountCount = await prisma.account.count({
        where: { 
          tenantId, 
          ownerId: userId,
          status: { not: AccountStatus.Archived }
        }
      })

      if (ownedAccountCount > 0) {
        constraints.push({
          entity: 'Owned Accounts',
          field: 'ownerId',
          count: ownedAccountCount,
          message: `Cannot delete user who owns ${ownedAccountCount} account(s). Please reassign account ownership first.`
        })
      }

      // Check for owned contacts
      const ownedContactCount = await prisma.contact.count({
        where: { 
          tenantId, 
          ownerId: userId,
          deletedAt: null
        }
      })

      if (ownedContactCount > 0) {
        constraints.push({
          entity: 'Owned Contacts',
          field: 'ownerId',
          count: ownedContactCount,
          message: `Cannot delete user who owns ${ownedContactCount} contact(s). Please reassign contact ownership first.`
        })
      }

      // Check for owned opportunities
      const ownedOpportunityCount = await prisma.opportunity.count({
        where: {
          tenantId,
          ownerId: userId,
          status: { in: ['Open', 'OnHold'] }
        }
      })

      if (ownedOpportunityCount > 0) {
        constraints.push({
          entity: 'Owned Opportunities',
          field: 'ownerId',
          count: ownedOpportunityCount,
          message: `Cannot delete user who owns ${ownedOpportunityCount} open opportunit(ies). Please reassign opportunity ownership first.`
        })
      }

      // Check for assigned activities
      const assignedActivityCount = await prisma.activity.count({
        where: {
          tenantId,
          assigneeId: userId,
          status: { in: ['Open'] }
        }
      })

      if (assignedActivityCount > 0) {
        constraints.push({
          entity: 'Assigned Activities',
          field: 'assigneeId',
          count: assignedActivityCount,
          message: `User has ${assignedActivityCount} assigned activit(ies). These will be orphaned if user is deleted.`
        })
      }

      return constraints
    }
  },

  // Add more entity checks as needed
  Opportunity: {
    entity: 'Opportunity',
    checkFunction: async (tenantId: string, opportunityId: string): Promise<DeletionConstraint[]> => {
      const constraints: DeletionConstraint[] = []

      // Check for associated revenue schedules
      const revenueScheduleCount = await prisma.revenueSchedule.count({
        where: {
          tenantId,
          opportunityId,
          status: { in: [RevenueScheduleStatus.Unreconciled, RevenueScheduleStatus.Underpaid, RevenueScheduleStatus.Overpaid] }
        }
      })

      if (revenueScheduleCount > 0) {
        constraints.push({
          entity: 'Revenue Schedules',
          field: 'opportunityId',
          count: revenueScheduleCount,
          message: `Cannot delete opportunity with ${revenueScheduleCount} active revenue schedule(s). Please complete or cancel revenue schedules first.`
        })
      }

      return constraints
    }
  }
}

// Main deletion functions
export async function checkDeletionConstraints(
  entity: string,
  entityId: string,
  tenantId: string
): Promise<DeletionConstraint[]> {
  const checker = RelationshipChecks[entity]
  if (!checker) {
    return []
  }

  return await checker.checkFunction(tenantId, entityId)
}

export async function softDeleteEntity(
  entity: string,
  entityId: string,
  tenantId: string,
  userId: string,
  bypassConstraints = false
): Promise<DeletionResult> {
  try {
    // Check constraints unless bypassed
    if (!bypassConstraints) {
      const constraints = await checkDeletionConstraints(entity, entityId, tenantId)
      if (constraints.length > 0) {
        return {
          success: false,
          stage: 'soft',
          constraints
        }
      }
    }

    const mapping = EntityStatusMappings[entity as keyof typeof EntityStatusMappings]
    if (!mapping) {
      return {
        success: false,
        stage: 'soft',
        error: `Entity type ${entity} not supported for soft deletion`
      }
    }

    // Perform soft delete based on entity type
    const updateData: any = {}
    
    if (mapping.statusField === 'deletedAt') {
      updateData.deletedAt = new Date()
    } else {
      const nextValue =
        entity === 'Account'
          ? (mapping as any).deletedStatus ?? mapping.inactiveStatus
          : mapping.inactiveStatus
      updateData[mapping.statusField] = nextValue
    }

    updateData.updatedById = userId

    // Update the entity
    await (prisma as any)[mapping.model].update({
      where: { id: entityId },
      data: updateData
    })

    return {
      success: true,
      stage: 'soft'
    }
  } catch (error) {
    console.error(`Soft delete failed for ${entity}:${entityId}`, error)
    return {
      success: false,
      stage: 'soft',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function permanentDeleteEntity(
  entity: string,
  entityId: string,
  tenantId: string,
  userId: string
): Promise<DeletionResult> {
  try {
    const mapping = EntityStatusMappings[entity as keyof typeof EntityStatusMappings]
    if (!mapping) {
      return {
        success: false,
        stage: 'permanent',
        error: `Entity type ${entity} not supported for permanent deletion`
      }
    }

    // Verify entity is already soft deleted
    const entityRecord = await (prisma as any)[mapping.model].findFirst({
      where: { 
        id: entityId,
        tenantId,
        ...(mapping.statusField === 'deletedAt' 
          ? { deletedAt: { not: null } }
          : {
              [mapping.statusField]:
                entity === 'Account'
                  ? (mapping as any).deletedStatus ?? mapping.inactiveStatus
                  : mapping.inactiveStatus
            }
        )
      }
    })

    if (!entityRecord) {
      return {
        success: false,
        stage: 'permanent',
        error: 'Entity not found or not in deleted state'
      }
    }

    if (entity === 'Account') {
      const dependencies = await getAccountPermanentDeleteDependencies(tenantId, entityId)
      if (dependencies.length > 0) {
        const summary = formatPermanentDependencySummary(dependencies)
        return {
          success: false,
          stage: 'permanent',
          error: `Cannot permanently delete this account because it still has related records (${summary}). Delete or reassign those records first, then try again.`
        }
      }
    }

    // Perform permanent deletion
    await (prisma as any)[mapping.model].delete({
      where: { id: entityId }
    })

    return {
      success: true,
      stage: 'permanent'
    }
  } catch (error) {
    console.error(`Permanent delete failed for ${entity}:${entityId}`, error)
    const code = error && typeof error === 'object' && 'code' in error ? (error as any).code : null
    if (code === 'P2003' || code === 'P2014') {
      return {
        success: false,
        stage: 'permanent',
        error: 'Cannot permanently delete because related records still reference this item. Delete or reassign related records first, then try again.'
      }
    }
    return {
      success: false,
      stage: 'permanent',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function restoreEntity(
  entity: string,
  entityId: string,
  tenantId: string,
  userId: string
): Promise<DeletionResult> {
  try {
    const mapping = EntityStatusMappings[entity as keyof typeof EntityStatusMappings]
    if (!mapping) {
      return {
        success: false,
        stage: 'soft',
        error: `Entity type ${entity} not supported for restoration`
      }
    }

    // Restore entity
    const updateData: any = {}
    
    if (mapping.statusField === 'deletedAt') {
      updateData.deletedAt = null
    } else {
      updateData[mapping.statusField] = mapping.activeStatus
    }

    updateData.updatedById = userId

    await (prisma as any)[mapping.model].update({
      where: { id: entityId },
      data: updateData
    })

    return {
      success: true,
      stage: 'soft'
    }
  } catch (error) {
    console.error(`Restore failed for ${entity}:${entityId}`, error)
    return {
      success: false,
      stage: 'soft',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

