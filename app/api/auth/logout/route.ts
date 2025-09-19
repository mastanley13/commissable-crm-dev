import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, terminateSession, clearSessionCookie } from '@/lib/auth'
import { prisma } from '@/lib/db'
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get current user and session
    const user = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get session token from cookie or header
    const sessionToken = request.cookies.get('session-token')?.value ||
                        request.headers.get('authorization')?.replace('Bearer ', '')

    if (sessionToken) {
      // Find and terminate the session
      const session = await prisma.userSession.findFirst({
        where: {
          sessionToken,
          userId: user.id,
          terminatedAt: null
        }
      })

      if (session) {
        await terminateSession(session.id)

        // Log logout audit
        await prisma.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            action: 'Login', // Using Login action with metadata to indicate logout
            entityName: 'User',
            entityId: user.id,
            ipAddress: request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
            metadata: {
              logoutMethod: 'manual',
              sessionId: session.id
            }
          }
        })
      }
    }

    // Clear session cookie
    await clearSessionCookie()

    return NextResponse.json({ message: 'Logged out successfully' })

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
