import { NextRequest } from 'next/server'
import { withPermissions, createApiResponse, createErrorResponse } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

// GET /api/admin/users - List users
export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['admin.users.read', 'accounts.manage'], // Admin permission or account management
    async (req) => {
      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const search = searchParams.get('search')
      const roleId = searchParams.get('roleId')
      const status = searchParams.get('status')

      const skip = (page - 1) * limit

      // Build where clause
      const where: any = {
        tenantId: req.user.tenantId
      }

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }

      if (roleId) {
        where.roleId = roleId
      }

      if (status) {
        where.status = status
      }

      // Get users with role information
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            role: {
              select: {
                id: true,
                code: true,
                name: true
              }
            },
            createdBy: {
              select: {
                fullName: true
              }
            }
          }
        }),
        prisma.user.count({ where })
      ])

      return createApiResponse({
        users: users.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          jobTitle: user.jobTitle,
          department: user.department,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          role: user.role,
          createdBy: user.createdBy?.fullName
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      })
    }
  )
}

// POST /api/admin/users - Create user
export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ['admin.users.create', 'accounts.manage'],
    async (req) => {
      const body = await request.json()
      const {
        email,
        password,
        firstName,
        lastName,
        jobTitle,
        department,
        roleId,
        status = 'Invited'
      } = body

      // Validate required fields
      if (!email || !firstName || !lastName) {
        return createErrorResponse('Email, first name, and last name are required', 400)
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          tenantId: req.user.tenantId
        }
      })

      if (existingUser) {
        return createErrorResponse('User with this email already exists', 409)
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

      // Hash password if provided
      let passwordHash = null
      if (password) {
        if (password.length < 8) {
          return createErrorResponse('Password must be at least 8 characters long', 400)
        }
        passwordHash = await hashPassword(password)
      }

      // Create user
      const newUser = await prisma.user.create({
        data: {
          tenantId: req.user.tenantId,
          roleId: roleId || null,
          email: email.toLowerCase().trim(),
          passwordHash,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          jobTitle: jobTitle || null,
          department: department || null,
          status,
          authProvider: 'Password',
          passwordChangedAt: passwordHash ? new Date() : null,
          createdById: req.user.id
        },
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

      // Log creation audit
      await prisma.auditLog.create({
        data: {
          tenantId: req.user.tenantId,
          userId: req.user.id,
          action: 'Create',
          entityName: 'User',
          entityId: newUser.id,
          newValues: {
            email: newUser.email,
            fullName: newUser.fullName,
            roleId: newUser.roleId,
            status: newUser.status
          }
        }
      })

      return createApiResponse({
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          fullName: newUser.fullName,
          jobTitle: newUser.jobTitle,
          department: newUser.department,
          status: newUser.status,
          createdAt: newUser.createdAt,
          role: newUser.role
        }
      }, 201)
    }
  )
}