import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword, createUserSession, setSessionCookie } from '@/lib/auth'
import { resolveTenantId } from '@/lib/server-utils'
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      firstName,
      lastName,
      jobTitle,
      department,
      tenantId: explicitTenantId,
      roleId
    } = body

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, password, first name, and last name are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Resolve tenant ID
    const tenantId = await resolveTenantId(explicitTenantId)

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        tenantId
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Get default role if none specified
    let userRoleId = roleId
    if (!userRoleId) {
      const defaultRole = await prisma.role.findFirst({
        where: {
          tenantId,
          isDefault: true
        }
      })
      userRoleId = defaultRole?.id || null
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const user = await prisma.user.create({
      data: {
        tenantId,
        roleId: userRoleId,
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName,
        lastName,
        middleName: null,
        fullName: `${firstName} ${lastName}`,
        jobTitle: jobTitle || null,
        department: department || null,
        status: 'Active',
        authProvider: 'Password',
        passwordChangedAt: new Date()
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
        }
      }
    })

    // Get client IP and User-Agent
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create session
    const { sessionToken, expiresAt } = await createUserSession(
      user.id,
      tenantId,
      ipAddress,
      userAgent
    )

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Log registration audit
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'Create',
        entityName: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: {
          registrationMethod: 'password',
          roleId: userRoleId
        }
      }
    })

    // Set session cookie
    await setSessionCookie(sessionToken, expiresAt)

    // Return user data (without sensitive info)
    return NextResponse.json({
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        roleId: user.roleId,
        status: user.status,
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
        } : null
      },
      expiresAt: expiresAt.toISOString()
    }, { status: 201 })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
