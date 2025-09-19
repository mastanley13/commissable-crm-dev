import { NextRequest } from 'next/server'
import { withPermissions, createApiResponse, createErrorResponse } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
export const dynamic = 'force-dynamic';

interface Params {
  userId: string
}

// GET /api/admin/users/[userId] - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const resolvedParams = await params
  return withPermissions(
    request,
    ['admin.users.read', 'accounts.manage'],
    async (req) => {
      const user = await prisma.user.findFirst({
        where: {
          id: resolvedParams.userId,
          tenantId: req.user.tenantId
        },
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          },
          sessions: {
            where: {
              terminatedAt: null,
              expiresAt: { gt: new Date() }
            },
            select: {
              id: true,
              ipAddress: true,
              userAgent: true,
              lastSeenAt: true,
              createdAt: true,
              expiresAt: true
            },
            orderBy: { lastSeenAt: 'desc' }
          }
        }
      })

      if (!user) {
        return createErrorResponse('User not found', 404)
      }

      return createApiResponse({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          jobTitle: user.jobTitle,
          department: user.department,
          mobilePhone: user.mobilePhone,
          workPhone: user.workPhone,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          passwordChangedAt: user.passwordChangedAt,
          authProvider: user.authProvider,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          role: user.role ? {
            id: user.role.id,
            code: user.role.code,
            name: user.role.name,
            permissions: user.role.permissions.map(rp => ({
              id: rp.permission.id,
              code: rp.permission.code,
              name: rp.permission.name,
              category: rp.permission.category
            }))
          } : null,
          activeSessions: user.sessions
        }
      })
    }
  )
}

// PUT /api/admin/users/[userId] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const resolvedParams = await params
  return withPermissions(
    request,
    ['admin.users.update', 'accounts.manage'],
    async (req) => {
      const body = await request.json()
      const {
        email,
        firstName,
        lastName,
        jobTitle,
        department,
        mobilePhone,
        workPhone,
        roleId,
        status,
        password
      } = body

      // Check if user exists
      const existingUser = await prisma.user.findFirst({
        where: {
          id: resolvedParams.userId,
          tenantId: req.user.tenantId
        }
      })

      if (!existingUser) {
        return createErrorResponse('User not found', 404)
      }

      // Check if email is already taken by another user
      if (email && email !== existingUser.email) {
        const emailTaken = await prisma.user.findFirst({
          where: {
            email: email.toLowerCase().trim(),
            tenantId: req.user.tenantId,
            id: { not: resolvedParams.userId }
          }
        })

        if (emailTaken) {
          return createErrorResponse('Email already taken by another user', 409)
        }
      }

      // Validate role if provided
      if (roleId) {
        const role = await prisma.role.findFirst({
          where: {
            id: roleId,
            tenantId: req.user.tenantId
          }
        })

        if (!role) {
          return createErrorResponse('Invalid role ID', 400)
        }
      }

      // Build update data
      const updateData: any = {
        updatedById: req.user.id
      }

      if (email) updateData.email = email.toLowerCase().trim()
      if (firstName) updateData.firstName = firstName
      if (lastName) updateData.lastName = lastName
      if (firstName || lastName) {
        updateData.fullName = `${firstName || existingUser.firstName} ${lastName || existingUser.lastName}`
      }
      if (jobTitle !== undefined) updateData.jobTitle = jobTitle
      if (department !== undefined) updateData.department = department
      if (mobilePhone !== undefined) updateData.mobilePhone = mobilePhone
      if (workPhone !== undefined) updateData.workPhone = workPhone
      if (roleId !== undefined) updateData.roleId = roleId
      if (status) updateData.status = status

      // Handle password update
      if (password) {
        if (password.length < 8) {
          return createErrorResponse('Password must be at least 8 characters long', 400)
        }
        updateData.passwordHash = await hashPassword(password)
        updateData.passwordChangedAt = new Date()
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: resolvedParams.userId },
        data: updateData,
        include: {
          role: {
            select: {
              id: true,
              code: true,
              name: true
            }
          }
        }
      })

      // Log update audit
      await prisma.auditLog.create({
        data: {
          tenantId: req.user.tenantId,
          userId: req.user.id,
          action: 'Update',
          entityName: 'User',
          entityId: updatedUser.id,
          changedFields: Object.keys(updateData),
          newValues: updateData
        }
      })

      return createApiResponse({
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          fullName: updatedUser.fullName,
          jobTitle: updatedUser.jobTitle,
          department: updatedUser.department,
          mobilePhone: updatedUser.mobilePhone,
          workPhone: updatedUser.workPhone,
          status: updatedUser.status,
          lastLoginAt: updatedUser.lastLoginAt,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
          role: updatedUser.role
        }
      })
    }
  )
}

// DELETE /api/admin/users/[userId] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const resolvedParams = await params
  return withPermissions(
    request,
    ['admin.users.delete'],
    async (req) => {
      // Check if user exists
      const user = await prisma.user.findFirst({
        where: {
          id: resolvedParams.userId,
          tenantId: req.user.tenantId
        }
      })

      if (!user) {
        return createErrorResponse('User not found', 404)
      }

      // Don't allow deleting yourself
      if (user.id === req.user.id) {
        return createErrorResponse('Cannot delete your own account', 400)
      }

      // For now, we'll soft delete by updating status to 'Disabled'
      // In a real app, you might want to handle data relationships differently
      const deletedUser = await prisma.user.update({
        where: { id: resolvedParams.userId },
        data: {
          status: 'Disabled',
          updatedById: req.user.id
        }
      })

      // Terminate all user sessions
      await prisma.userSession.updateMany({
        where: {
          userId: resolvedParams.userId,
          terminatedAt: null
        },
        data: {
          terminatedAt: new Date()
        }
      })

      // Log deletion audit
      await prisma.auditLog.create({
        data: {
          tenantId: req.user.tenantId,
          userId: req.user.id,
          action: 'Delete',
          entityName: 'User',
          entityId: deletedUser.id,
          metadata: {
            action: 'soft_delete',
            previousStatus: user.status
          }
        }
      })

      return createApiResponse({
        message: 'User account disabled successfully'
      })
    }
  )
}
