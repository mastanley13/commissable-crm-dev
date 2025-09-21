import { NextRequest } from 'next/server'
import { withPermissions, createApiResponse, createErrorResponse } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

// GET /api/admin/roles - List roles
export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['admin.roles.read', 'accounts.manage'],
    async (req) => {
      const { searchParams } = new URL(request.url)
      const includePermissions = searchParams.get('includePermissions') === 'true'

      const roles = await prisma.role.findMany({
        where: {
          tenantId: req.user.tenantId
        },
        orderBy: { name: 'asc' },
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

      return createApiResponse({
        roles: roles.map(role => ({
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
              grantedAt: rp.grantedAt
            }))
          })
        }))
      })
    }
  )
}

// POST /api/admin/roles - Create role
export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ['admin.roles.create'],
    async (req) => {
      const body = await request.json()
      const {
        code,
        name,
        description,
        isDefault = false,
        permissionIds = []
      } = body

      // Validate required fields
      if (!code || !name) {
        return createErrorResponse('Code and name are required', 400)
      }

      // Check if role code already exists
      const existingRole = await prisma.role.findFirst({
        where: {
          code,
          tenantId: req.user.tenantId
        }
      })

      if (existingRole) {
        return createErrorResponse('Role with this code already exists', 409)
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

      // Create role
      const newRole = await prisma.role.create({
        data: {
          tenantId: req.user.tenantId,
          code,
          name,
          description: description || null,
          scope: 'Tenant',
          isDefault
        }
      })

      // Create role permissions if provided
      if (permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId: string) => ({
            tenantId: req.user.tenantId,
            roleId: newRole.id,
            permissionId,
            grantedById: req.user.id
          }))
        })
      }

      // Log creation audit
      await prisma.auditLog.create({
        data: {
          tenantId: req.user.tenantId,
          userId: req.user.id,
          action: 'Create',
          entityName: 'Role',
          entityId: newRole.id,
          newValues: {
            code: newRole.code,
            name: newRole.name,
            description: newRole.description,
            isDefault: newRole.isDefault,
            permissionIds
          }
        }
      })

      // Fetch complete role with permissions
      const completeRole = await prisma.role.findUnique({
        where: { id: newRole.id },
        include: {
          permissions: {
            include: {
              permission: true
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
          createdAt: completeRole!.createdAt,
          permissions: completeRole!.permissions.map(rp => ({
            id: rp.permission.id,
            code: rp.permission.code,
            name: rp.permission.name,
            category: rp.permission.category
          }))
        }
      }, 201)
    }
  )
}
