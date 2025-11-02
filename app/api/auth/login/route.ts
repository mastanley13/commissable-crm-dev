import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword, createUserSession, setSessionCookie } from '@/lib/auth'
import { resolveTenantId } from '@/lib/server-utils'
import type { Prisma } from '@prisma/client'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

type UserWithRolePermissions = Prisma.UserGetPayload<{
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
}>

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, tenantId: explicitTenantId } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Resolve tenant ID
    const tenantId = await resolveTenantId(explicitTenantId)

    // Find user by email and tenant
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        tenantId,
        status: { in: ['Active', 'Invited'] }
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
    }) as UserWithRolePermissions | null

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if user has a password set
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Account not activated. Please set up your password.' },
        { status: 401 }
      )
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

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

    // Log login audit
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'Login',
        entityName: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: {
          loginMethod: 'password',
          sessionToken: sessionToken.substring(0, 10) + '...' // Log partial token for debugging
        }
      }
    })

    // Create response with user data
    const response = NextResponse.json({
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
    })

    // Set session cookie on response
    response.cookies.set('session-token', sessionToken, {
      expires: expiresAt,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    })

    console.log('dY"? Login Debug:')
    console.log('  Session token created:', sessionToken.substring(0, 10) + '...')
    console.log('  Cookie expires:', expiresAt)
    console.log('  User permissions:', user.role?.permissions.length || 0)
    
    const dataMgmtPerms = user.role?.permissions.filter(rp => 
      rp.permission.code.includes('data_management')
    ) || []
    console.log('  Data Management Permissions:', dataMgmtPerms.length)
    dataMgmtPerms.forEach(rp => console.log('    ?o.', rp.permission.code))

    return response

  } catch (error) {
    console.error('Login error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    // Surface a clearer message in development for common setup issue
    if (message.includes('No tenants available')) {
      const payload: any = { error: 'Database not initialized' }
      if (process.env.NODE_ENV !== 'production') {
        payload.hint = 'Run: npx prisma db push && npm run db:seed'
      }
      return NextResponse.json(payload, { status: 503 })
    }
    const payload: any = { error: 'Internal server error' }
    if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
      payload.detail = error.message
    }
    return NextResponse.json(payload, { status: 500 })
  }
}

