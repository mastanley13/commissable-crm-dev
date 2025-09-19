import { NextRequest } from 'next/server'
import { withPermissions, createApiResponse, createErrorResponse } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
export const dynamic = 'force-dynamic';

// GET /api/admin/roles/[id] - Get role details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withPermissions(
    request,
    ['admin.roles.read'],
    async (req) => {
      const { searchParams } = new URL(request.url)
      const includePermissions = searchParams.get('includePermissions') === 'true'

      const role = await prisma.role.findFirst({
        where: {
          id: params.id,
          tenantId: req.user.tenantId
        },
        include: {
          permissions: includePermissions ? {
            include: {
              permission: true
            }
          } : false,
          users: {
            select: {
              id: true
            }
          }
        }
      })

      if (!role) {
        return createErrorResponse('Role not found', 404)
      }

      return createApiResponse({
        role: {
          id: role.id,
          code: role.code,
          name: role.name,
          description: role.description,
          scope: role.scope,
          isDefault: role.isDefault,
          userCount: role.users.length,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
          ...(includePermissions && role.permissions && {
            permissions: role.permissions.map((rp: any) => ({
              id: rp.permission.id,
              code: rp.permission.code,
              name: rp.permission.name,
              category: rp.permission.category,
              description: rp.permission.description,
              grantedAt: rp.grantedAt
            }))
          })
        }
      })
    }
  )
}

// PUT /api/admin/roles/[id] - Update role
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withPermissions(
    request,
    ['admin.roles.update'],
    async (req) => {
      const body = await request.json()
      const {
        name,
        description,
        permissionIds = []
      } = body

      // Validate required fields
      if (!name) {
        return createErrorResponse('Name is required', 400)
      }

      // Check if role exists
      const existingRole = await prisma.role.findFirst({
        where: {
          id: params.id,
          tenantId: req.user.tenantId
        }
      })

      if (!existingRole) {
        return createErrorResponse('Role not found', 404)
      }

      // Validate permissions if provided
      if (permissionIds.length > 0) {
        const validPermissions = await prisma.permission.findMany({
          where: {
            id: { in: permissionIds }
          }
        })

        if (validPermissions.length !== permissionIds.length) {
          return createErrorResponse('One or more invalid permission IDs', 400)
        }
      }

      // Update role
      const updatedRole = await prisma.role.update({
        where: { id: params.id },
        data: {
          name,
          description: description || null
        }
      })

      // Update role permissions if provided
      if (permissionIds.length >= 0) {
        // Remove existing permissions
        await prisma.rolePermission.deleteMany({
          where: {
            roleId: params.id
          }
        })

        // Add new permissions
        if (permissionIds.length > 0) {
          await prisma.rolePermission.createMany({
            data: permissionIds.map((permissionId: string) => ({
              tenantId: req.user.tenantId,
              roleId: params.id,
              permissionId,
              grantedById: req.user.id
            }))
          })
        }
      }

      // Log update audit
      await prisma.auditLog.create({
        data: {
          tenantId: req.user.tenantId,
          userId: req.user.id,
          action: 'Update',
          entityName: 'Role',
          entityId: params.id,
          previousValues: {
            name: existingRole.name,
            description: existingRole.description
          },
          newValues: {
            name: updatedRole.name,
            description: updatedRole.description,
            permissionIds
          }
        }
      })

      // Fetch complete updated role with permissions
      const completeRole = await prisma.role.findUnique({
        where: { id: params.id },
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          users: {
            select: {
              id: true
            }
          }
        }
      })

      return createApiResponse({
        role: {
          id: completeRole!.id,
          code: completeRole!.code,
          name: completeRole!.name,
          description: completeRole!.description,
          scope: completeRole!.scope,
          isDefault: completeRole!.isDefault,
          userCount: completeRole!.users.length,
          createdAt: completeRole!.createdAt,
          updatedAt: completeRole!.updatedAt,
          permissions: completeRole!.permissions.map(rp => ({
            id: rp.permission.id,
            code: rp.permission.code,
            name: rp.permission.name,
            category: rp.permission.category,
            description: rp.permission.description
          }))
        }
      })
    }
  )
}

// DELETE /api/admin/roles/[id] - Delete role
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withPermissions(
    request,
    ['admin.roles.delete'],
    async (req) => {
      // Check if role exists
      const existingRole = await prisma.role.findFirst({
        where: {
          id: params.id,
          tenantId: req.user.tenantId
        },
        include: {
          users: {
            select: {
              id: true
            }
          }
        }
      })

      if (!existingRole) {
        return createErrorResponse('Role not found', 404)
      }

      // Check if role is in use
      if (existingRole.users.length > 0) {
        return createErrorResponse('Cannot delete role that is assigned to users', 409)
      }

      // Check if role is default
      if (existingRole.isDefault) {
        return createErrorResponse('Cannot delete default role', 409)
      }

      // Delete role permissions first
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: params.id
        }
      })

      // Delete role
      await prisma.role.delete({
        where: { id: params.id }
      })

      // Log deletion audit
      await prisma.auditLog.create({
        data: {
          tenantId: req.user.tenantId,
          userId: req.user.id,
          action: 'Delete',
          entityName: 'Role',
          entityId: params.id,
          previousValues: {
            code: existingRole.code,
            name: existingRole.name,
            description: existingRole.description
          }
        }
      })

      return createApiResponse({ success: true })
    }
  )
}

