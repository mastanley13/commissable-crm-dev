import { NextRequest } from 'next/server'
import { withPermissions, createApiResponse, createErrorResponse } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

// GET /api/admin/permissions - List all permissions
export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['admin.permissions.read'],
    async (req) => {
      const { searchParams } = new URL(request.url)
      const category = searchParams.get('category')

      const whereClause: any = {}
      if (category) {
        whereClause.category = category
      }

      const permissions = await prisma.permission.findMany({
        where: whereClause,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' }
        ]
      })

      return createApiResponse({
        permissions: permissions.map(permission => ({
          id: permission.id,
          code: permission.code,
          name: permission.name,
          description: permission.description,
          category: permission.category
        }))
      })
    }
  )
}

// POST /api/admin/permissions - Create permission
export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ['admin.permissions.create'],
    async (req) => {
      const body = await request.json()
      const {
        code,
        name,
        description,
        category
      } = body

      // Validate required fields
      if (!code || !name || !category) {
        return createErrorResponse('Code, name, and category are required', 400)
      }

      // Check if permission code already exists
      const existingPermission = await prisma.permission.findUnique({
        where: { code }
      })

      if (existingPermission) {
        return createErrorResponse('Permission with this code already exists', 409)
      }

      // Create permission
      const newPermission = await prisma.permission.create({
        data: {
          code,
          name,
          description: description || null,
          category
        }
      })

      // Log creation audit
      await prisma.auditLog.create({
        data: {
          tenantId: req.user.tenantId,
          userId: req.user.id,
          action: 'Create',
          entityName: 'Permission',
          entityId: newPermission.id,
          newValues: {
            code: newPermission.code,
            name: newPermission.name,
            description: newPermission.description,
            category: newPermission.category
          }
        }
      })

      return createApiResponse({
        permission: {
          id: newPermission.id,
          code: newPermission.code,
          name: newPermission.name,
          description: newPermission.description,
          category: newPermission.category
        }
      }, 201)
    }
  )
}
