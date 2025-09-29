import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { validateManagerReassignmentPermission, validateAccountReassignment } from "@/lib/reassignment-validation";
import { calculateCommissionImpact } from "@/lib/commission-calculator";
import { handleSpecialUserAssignment } from "@/lib/special-users";

interface BulkReassignmentRequest {
  accountIds: string[];
  newOwnerId: string;
  assignmentRole: string;
  effectiveDate: string;
  transferCommissions: boolean;
  notifyUsers: boolean;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { user, tenantId } = await getCurrentUser();

    // Validate manager permissions
    await validateManagerReassignmentPermission(user, tenantId);

    const body: BulkReassignmentRequest = await request.json();

    // Validate input
    if (!body.accountIds || !Array.isArray(body.accountIds) || body.accountIds.length === 0) {
      return NextResponse.json(
        { error: "Account IDs are required" },
        { status: 400 }
      );
    }

    if (!body.newOwnerId) {
      return NextResponse.json(
        { error: "New owner ID is required" },
        { status: 400 }
      );
    }

    if (!body.assignmentRole) {
      return NextResponse.json(
        { error: "Assignment role is required" },
        { status: 400 }
      );
    }

    if (!body.effectiveDate) {
      return NextResponse.json(
        { error: "Effective date is required" },
        { status: 400 }
      );
    }

    const effectiveDate = new Date(body.effectiveDate);
    if (isNaN(effectiveDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid effective date format" },
        { status: 400 }
      );
    }

    // Validate accounts and permissions
    const accounts = await validateAccountReassignment(
      body.accountIds,
      body.newOwnerId,
      user,
      tenantId
    );

    // Calculate commission impact
    const commissionImpact = await calculateCommissionImpact(
      body.accountIds,
      body.newOwnerId,
      body.effectiveDate,
      body.transferCommissions
    );

    // Execute reassignment in transaction
    const result = await prisma.$transaction(async (tx) => {
      const reassignments = [];

      for (const accountId of body.accountIds) {
        const account = accounts.find(a => a.id === accountId);
        if (!account) continue;

        // Update primary ownership
        await tx.account.update({
          where: { id: accountId },
          data: {
            ownerId: body.newOwnerId,
            updatedById: user.id,
            updatedAt: new Date()
          }
        });

        // Handle special user assignments
        if (body.newOwnerId === 'house' || body.newOwnerId === 'unassigned') {
          await handleSpecialUserAssignment(
            tx,
            accountId,
            body.newOwnerId,
            body.assignmentRole,
            tenantId,
            user.id,
            effectiveDate
          );
        } else {
          // Update/create assignment records for regular users
          await tx.accountAssignment.upsert({
            where: {
              accountId_userId: {
                accountId,
                userId: body.newOwnerId
              }
            },
            create: {
              accountId,
              userId: body.newOwnerId,
              tenantId,
              assignmentRole: body.assignmentRole as any,
              isPrimary: body.assignmentRole === 'PrimaryOwner',
              assignedById: user.id,
              assignedAt: effectiveDate
            },
            update: {
              assignmentRole: body.assignmentRole as any,
              isPrimary: body.assignmentRole === 'PrimaryOwner',
              assignedById: user.id,
              assignedAt: effectiveDate
            }
          });
        }

        // Handle commission transfers if requested
        if (body.transferCommissions) {
          await transferAccountCommissions(
            tx,
            accountId,
            body.newOwnerId,
            effectiveDate
          );
        }

        // Create audit log
        await logAccountReassignment(tx, {
          accountId,
          previousOwnerId: account.ownerId,
          newOwnerId: body.newOwnerId,
          assignmentRole: body.assignmentRole,
          effectiveDate: body.effectiveDate,
          reassignedById: user.id,
          reason: body.reason,
          commissionTransfer: body.transferCommissions,
          tenantId,
          isBulkOperation: true,
          accountCount: body.accountIds.length
        });

        reassignments.push({
          accountId,
          status: 'success',
          accountName: account.accountName
        });
      }

      return {
        reassignments,
        commissionImpact,
        totalAccounts: body.accountIds.length
      };
    });

    // Send notifications if requested (outside transaction)
    if (body.notifyUsers) {
      await sendReassignmentNotifications({
        accountIds: body.accountIds,
        newOwnerId: body.newOwnerId,
        previousOwners: accounts.map(a => a.ownerId).filter(Boolean),
        reassignedBy: user,
        effectiveDate: body.effectiveDate
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Account reassignment failed:', error);

    if (error.message === 'INSUFFICIENT_PERMISSIONS') {
      return NextResponse.json(
        { error: 'Insufficient permissions for account reassignment' },
        { status: 403 }
      );
    }

    if (error.message === 'MANAGER_ROLE_REQUIRED') {
      return NextResponse.json(
        { error: 'Manager role required for account reassignment' },
        { status: 403 }
      );
    }

    if (error.message === 'ACCOUNTS_NOT_FOUND') {
      return NextResponse.json(
        { error: 'One or more accounts not found' },
        { status: 404 }
      );
    }

    if (error.message?.includes('CANNOT_REASSIGN_ACCOUNT')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to reassign accounts' },
      { status: 500 }
    );
  }
}

// Validation functions
async function validateAccountReassignment(
  accountIds: string[],
  newOwnerId: string,
  requestingUser: any,
  tenantId: string
) {
  // Validate accounts exist and user has access
  const accounts = await prisma.account.findMany({
    where: {
      id: { in: accountIds },
      tenantId
    },
    include: {
      owner: true,
      assignments: true
    }
  });

  if (accounts.length !== accountIds.length) {
    throw new Error('ACCOUNTS_NOT_FOUND');
  }

  // Check if requesting user can reassign these accounts
  for (const account of accounts) {
    const canReassign = await canUserReassignAccount(requestingUser, account, tenantId);
    if (!canReassign) {
      throw new Error(`CANNOT_REASSIGN_ACCOUNT: ${account.accountName}`);
    }
  }

  // Validate new owner exists and can receive assignments
  await validateNewOwner(newOwnerId, tenantId);

  return accounts;
}

async function canUserReassignAccount(user: any, account: any, tenantId: string): Promise<boolean> {
  // Users can reassign accounts they own
  if (account.ownerId === user.id) {
    return true;
  }

  // Check if user has manager permissions
  const userPermissions = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      tenantId,
      role: {
        permissions: {
          some: {
            permission: {
              name: 'accounts.reassign'
            }
          }
        }
      }
    }
  });

  return !!userPermissions;
}

async function validateNewOwner(newOwnerId: string, tenantId: string) {
  if (newOwnerId === 'house' || newOwnerId === 'unassigned') {
    return; // Special assignments don't need user validation
  }

  const newOwner = await prisma.user.findFirst({
    where: {
      id: newOwnerId,
      tenantId,
      status: 'Active'
    }
  });

  if (!newOwner) {
    throw new Error('INVALID_NEW_OWNER');
  }

  return newOwner;
}

async function handleSpecialUserAssignment(
  tx: any,
  accountId: string,
  specialUserId: string,
  assignmentRole: string,
  tenantId: string,
  assignedById: string,
  assignedAt: Date
) {
  if (specialUserId === 'house') {
    // Create house assignment record
    await tx.accountAssignment.create({
      data: {
        accountId,
        userId: null, // House assignment has no user
        tenantId,
        assignmentRole: assignmentRole as any,
        isPrimary: assignmentRole === 'PrimaryOwner',
        assignedById,
        assignedAt,
        metadata: {
          assignmentType: 'house'
        }
      }
    });
  } else if (specialUserId === 'unassigned') {
    // Remove owner assignment
    await tx.account.update({
      where: { id: accountId },
      data: {
        ownerId: null,
        updatedById: assignedById,
        updatedAt: new Date()
      }
    });

    // Remove all assignments
    await tx.accountAssignment.deleteMany({
      where: { accountId }
    });
  }
}

async function transferAccountCommissions(
  tx: any,
  accountId: string,
  newOwnerId: string,
  effectiveDate: Date
) {
  // Transfer future revenue schedules
  await tx.revenueSchedule.updateMany({
    where: {
      accountId,
      scheduledDate: { gte: effectiveDate }
    },
    data: {
      assignedToId: newOwnerId === 'house' ? null : newOwnerId,
      updatedAt: new Date()
    }
  });

  // Transfer future opportunities
  await tx.opportunity.updateMany({
    where: {
      accountId,
      expectedCloseDate: { gte: effectiveDate }
    },
    data: {
      assignedToId: newOwnerId === 'house' ? null : newOwnerId,
      updatedAt: new Date()
    }
  });
}
