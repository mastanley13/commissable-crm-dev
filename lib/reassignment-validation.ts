import { prisma } from "@/lib/db";
import { hasPermission, hasAllPermissions } from "@/lib/auth";

export async function validateManagerReassignmentPermission(
  user: any,
  tenantId: string
): Promise<void> {
  // Check if user has reassignment permission
  const hasReassignPermission = await hasPermission(user, 'accounts.reassign');
  const hasBulkPermission = await hasPermission(user, 'accounts.bulk');

  if (!hasReassignPermission || !hasBulkPermission) {
    throw new Error('INSUFFICIENT_PERMISSIONS');
  }

  // Additional manager-level validation
  const userRole = await getUserRole(user.id, tenantId);
  const managerRoles = ['Sales Management', 'Admin', 'System Admin'];

  if (!userRole || !managerRoles.includes(userRole.name)) {
    throw new Error('MANAGER_ROLE_REQUIRED');
  }
}

export async function validateAccountReassignment(
  accountIds: string[],
  newOwnerId: string,
  requestingUser: any,
  tenantId: string
): Promise<any[]> {
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

export async function canUserReassignAccount(
  user: any,
  account: any,
  tenantId: string
): Promise<boolean> {
  // Users can reassign accounts they own
  if (account.ownerId === user.id) {
    return true;
  }

  // Check if user has manager permissions
  const hasReassignPermission = await hasPermission(user, 'accounts.reassign');
  const hasBulkPermission = await hasPermission(user, 'accounts.bulk');

  if (!hasReassignPermission || !hasBulkPermission) {
    return false;
  }

  // Additional validation: managers can reassign accounts in their hierarchy
  const userRole = await getUserRole(user.id, tenantId);
  const managerRoles = ['Sales Management', 'Admin', 'System Admin'];

  if (userRole && managerRoles.includes(userRole.name)) {
    return true;
  }

  return false;
}

export async function validateNewOwner(newOwnerId: string, tenantId: string): Promise<any> {
  // Special assignments don't need user validation
  if (newOwnerId === 'house' || newOwnerId === 'unassigned') {
    return null;
  }

  // Validate regular user
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

export async function getUserRole(userId: string, tenantId: string) {
  const userRole = await prisma.userRole.findFirst({
    where: {
      userId,
      tenantId
    },
    include: {
      role: true
    }
  });

  return userRole?.role || null;
}

export async function getCurrentUser() {
  // This function should be implemented in your auth system
  // For now, returning a mock implementation
  // In a real implementation, this would get the current user from session/JWT
  throw new Error('getCurrentUser not implemented - should be provided by auth context');
}

export async function getSystemSettings(tenantId: string, settingPath: string) {
  // Get system settings for the tenant
  const settings = await prisma.systemSettings.findFirst({
    where: {
      tenantId,
      settingKey: settingPath
    }
  });

  return settings?.settingValue || {};
}
