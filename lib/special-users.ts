import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSystemSettings } from "@/lib/reassignment-validation";

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

export interface SpecialUser {
  id: string;
  type: 'house' | 'unassigned' | 'dummy';
  name: string;
  description: string;
}

export async function getSpecialUsers(tenantId: string): Promise<SpecialUser[]> {
  const settings = await getSystemSettings(tenantId, 'reassignment.*');

  const specialUsers: SpecialUser[] = [];

  if (settings.allowHouseAccounts !== false) {
    specialUsers.push({
      id: 'house',
      type: 'house',
      name: 'House Account',
      description: 'Assign to house for company-managed accounts'
    });
  }

  if (settings.allowUnassigned !== false) {
    specialUsers.push({
      id: 'unassigned',
      type: 'unassigned',
      name: 'Unassigned',
      description: 'Remove owner assignment'
    });
  }

  const dummyReps = await prisma.user.findMany({
    where: {
      tenantId,
      email: { startsWith: 'dummy.' },
      status: 'Active'
    }
  });

  specialUsers.push(
    ...dummyReps.map(user => ({
      id: user.id,
      type: 'dummy' as const,
      name: user.fullName,
      description: 'Dummy rep placeholder'
    }))
  );

  return specialUsers;
}

export async function handleSpecialUserAssignment(
  accountId: string,
  specialUserId: string,
  assignmentRole: string,
  tenantId: string,
  assignedById: string,
  assignedAt: Date,
  client?: PrismaClientOrTransaction
): Promise<void> {
  const db = client ?? prisma;

  if (specialUserId === 'house') {
    // Create house assignment record
    await createHouseAccountAssignment(accountId, assignmentRole, tenantId, assignedById, assignedAt, db);
  } else if (specialUserId === 'unassigned') {
    // Remove owner assignment
    await removeAccountOwnership(accountId, tenantId, assignedById, db);
  } else {
    // Handle dummy rep assignment normally
    await assignAccountToUser(accountId, specialUserId, assignmentRole, tenantId, assignedById, assignedAt, db);
  }
}

export async function createHouseAccountAssignment(
  accountId: string,
  assignmentRole: string,
  tenantId: string,
  assignedById: string,
  assignedAt: Date,
  client?: PrismaClientOrTransaction
): Promise<void> {
  await removeAccountOwnership(accountId, tenantId, assignedById, client, 'House assignment');
}

export async function removeAccountOwnership(
  accountId: string,
  tenantId: string,
  removedById: string,
  client?: PrismaClientOrTransaction,
  reason: string = 'Bulk reassignment to unassigned'
): Promise<void> {
  const db = client ?? prisma;

  await db.account.update({
    where: { id: accountId },
    data: {
      ownerId: null,
      updatedById: removedById,
      updatedAt: new Date()
    }
  });

  await db.accountAssignment.deleteMany({
    where: { accountId }
  });

  await db.auditLog.create({
    data: {
      tenantId,
      userId: removedById,
      action: 'Update',
      entityName: 'Account',
      entityId: accountId,
      changedFields: ['ownerId', 'assignments'],
      previousValues: { ownerId: 'had_owner' },
      newValues: { ownerId: null, assignments: [] },
      metadata: {
        reason
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
  assignedAt: Date,
  client?: PrismaClientOrTransaction
): Promise<void> {
  const db = client ?? prisma;

  // Update primary ownership
  await db.account.update({
    where: { id: accountId },
    data: {
      ownerId: assignmentRole === 'PrimaryOwner' ? userId : undefined,
      updatedById: assignedById,
      updatedAt: new Date()
    }
  });

  // Update/create assignment record
  await db.accountAssignment.upsert({
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
      email: { startsWith: 'dummy.' },
      status: 'Active'
    },
    select: {
      id: true,
      fullName: true,
      createdAt: true
    }
  });
}

export async function createDummyRep(
  tenantId: string,
  name: string,
  createdById: string,
  description?: string
): Promise<any> {
  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.length > 0 ? rest.join(' ') : 'Account';

  return await prisma.user.create({
    data: {
      tenantId,
      firstName: firstName || name,
      lastName,
      fullName: name,
      email: `dummy.${Date.now()}@internal`,
      status: 'Active',
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

  const dummyRep = await prisma.user.findFirst({
    where: {
      id: specialUserId,
      tenantId,
      email: { startsWith: 'dummy.' },
      status: 'Active'
    }
  });

  return !!dummyRep;
}









