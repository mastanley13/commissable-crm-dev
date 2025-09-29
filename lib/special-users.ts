import { prisma } from "@/lib/db";
import { getSystemSettings } from "@/lib/reassignment-validation";

export interface SpecialUser {
  id: string;
  type: 'house' | 'unassigned' | 'dummy';
  name: string;
  description: string;
}

export async function getSpecialUsers(tenantId: string): Promise<SpecialUser[]> {
  // Check if tenant has configured special users
  const settings = await getSystemSettings(tenantId, 'reassignment.*');

  const specialUsers: SpecialUser[] = [];

  // House Account
  if (settings.allowHouseAccounts !== false) {
    specialUsers.push({
      id: 'house',
      type: 'house',
      name: 'House Account',
      description: 'Assign to house for company-managed accounts'
    });
  }

  // Unassigned
  if (settings.allowUnassigned !== false) {
    specialUsers.push({
      id: 'unassigned',
      type: 'unassigned',
      name: 'Unassigned',
      description: 'Remove owner assignment'
    });
  }

  // Get configured dummy reps
  const dummyReps = await prisma.user.findMany({
    where: {
      tenantId,
      userType: 'DummyRep', // New enum value
      status: 'Active'
    }
  });

  specialUsers.push(...dummyReps.map(user => ({
    id: user.id,
    type: 'dummy' as const,
    name: user.fullName,
    description: `Dummy rep: ${user.description || 'System placeholder'}`
  })));

  return specialUsers;
}

export async function handleSpecialUserAssignment(
  accountId: string,
  specialUserId: string,
  assignmentRole: string,
  tenantId: string,
  assignedById: string,
  assignedAt: Date
): Promise<void> {
  if (specialUserId === 'house') {
    // Create house assignment record
    await createHouseAccountAssignment(accountId, assignmentRole, tenantId, assignedById, assignedAt);
  } else if (specialUserId === 'unassigned') {
    // Remove owner assignment
    await removeAccountOwnership(accountId, tenantId, assignedById);
  } else {
    // Handle dummy rep assignment normally
    await assignAccountToUser(accountId, specialUserId, assignmentRole, tenantId, assignedById, assignedAt);
  }
}

export async function createHouseAccountAssignment(
  accountId: string,
  assignmentRole: string,
  tenantId: string,
  assignedById: string,
  assignedAt: Date
): Promise<void> {
  // Check if house assignment already exists
  const existingAssignment = await prisma.accountAssignment.findFirst({
    where: {
      accountId,
      userId: null, // House assignments have null userId
      tenantId,
      assignmentRole: assignmentRole as any
    }
  });

  if (existingAssignment) {
    // Update existing assignment
    await prisma.accountAssignment.update({
      where: { id: existingAssignment.id },
      data: {
        assignedById,
        assignedAt,
        updatedAt: new Date()
      }
    });
  } else {
    // Create new house assignment
    await prisma.accountAssignment.create({
      data: {
        accountId,
        userId: null, // House assignment
        tenantId,
        assignmentRole: assignmentRole as any,
        isPrimary: assignmentRole === 'PrimaryOwner',
        assignedById,
        assignedAt,
        metadata: {
          assignmentType: 'house',
          assignedBySystem: true
        }
      }
    });
  }
}

export async function removeAccountOwnership(
  accountId: string,
  tenantId: string,
  removedById: string
): Promise<void> {
  // Remove primary ownership
  await prisma.account.update({
    where: { id: accountId },
    data: {
      ownerId: null,
      updatedById: removedById,
      updatedAt: new Date()
    }
  });

  // Remove all assignments
  await prisma.accountAssignment.deleteMany({
    where: { accountId }
  });

  // Log the change
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: removedById,
      action: 'ACCOUNT_UNASSIGNED',
      entityType: 'ACCOUNT',
      entityId: accountId,
      changedFields: ['ownerId', 'assignments'],
      previousValues: { ownerId: 'had_owner' },
      newValues: { ownerId: null, assignments: [] },
      metadata: {
        reason: 'Bulk reassignment to unassigned'
      },
      createdAt: new Date()
    }
  });
}

export async function assignAccountToUser(
  accountId: string,
  userId: string,
  assignmentRole: string,
  tenantId: string,
  assignedById: string,
  assignedAt: Date
): Promise<void> {
  // Update primary ownership
  await prisma.account.update({
    where: { id: accountId },
    data: {
      ownerId: assignmentRole === 'PrimaryOwner' ? userId : undefined,
      updatedById: assignedById,
      updatedAt: new Date()
    }
  });

  // Update/create assignment record
  await prisma.accountAssignment.upsert({
    where: {
      accountId_userId: {
        accountId,
        userId
      }
    },
    create: {
      accountId,
      userId,
      tenantId,
      assignmentRole: assignmentRole as any,
      isPrimary: assignmentRole === 'PrimaryOwner',
      assignedById,
      assignedAt
    },
    update: {
      assignmentRole: assignmentRole as any,
      isPrimary: assignmentRole === 'PrimaryOwner',
      assignedById,
      assignedAt
    }
  });
}

export async function getDummyReps(tenantId: string): Promise<any[]> {
  return await prisma.user.findMany({
    where: {
      tenantId,
      userType: 'DummyRep',
      status: 'Active'
    },
    select: {
      id: true,
      fullName: true,
      description: true,
      createdAt: true
    }
  });
}

export async function createDummyRep(
  tenantId: string,
  name: string,
  description?: string,
  createdById: string
): Promise<any> {
  return await prisma.user.create({
    data: {
      tenantId,
      firstName: name.split(' ')[0] || name,
      lastName: name.split(' ').slice(1).join(' ') || 'Account',
      email: `dummy.${Date.now()}@internal`, // Generate unique email
      password: 'dummy-password-placeholder', // This should be handled by auth system
      userType: 'DummyRep',
      status: 'Active',
      description,
      createdById,
      updatedById: createdById
    }
  });
}

export async function validateSpecialUserAssignment(
  specialUserId: string,
  tenantId: string
): Promise<boolean> {
  if (specialUserId === 'house' || specialUserId === 'unassigned') {
    const settings = await getSystemSettings(tenantId, 'reassignment.*');

    if (specialUserId === 'house' && settings.allowHouseAccounts === false) {
      return false;
    }

    if (specialUserId === 'unassigned' && settings.allowUnassigned === false) {
      return false;
    }

    return true;
  }

  // For dummy reps, validate they exist and are active
  const dummyRep = await prisma.user.findFirst({
    where: {
      id: specialUserId,
      tenantId,
      userType: 'DummyRep',
      status: 'Active'
    }
  });

  return !!dummyRep;
}
