import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, createUserSession, setSessionCookie, terminateSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get current session token
    const currentSessionToken = request.cookies.get('session-token')?.value

    if (!currentSessionToken) {
      return NextResponse.json(
        { error: 'No session token found' },
        { status: 401 }
      )
    }

    // Find current session
    const currentSession = await prisma.userSession.findFirst({
      where: {
        sessionToken: currentSessionToken,
        userId: user.id,
        terminatedAt: null
      }
    })

    if (!currentSession) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Get client IP and User-Agent
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create new session
    const { sessionToken: newSessionToken, expiresAt } = await createUserSession(
      user.id,
      user.tenantId,
      ipAddress,
      userAgent
    )

    // Terminate old session
    await terminateSession(currentSession.id)

    // Set new session cookie
    await setSessionCookie(newSessionToken, expiresAt)

    // Log session refresh audit
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'Update',
        entityName: 'UserSession',
        entityId: currentSession.id,
        ipAddress,
        userAgent,
        metadata: {
          action: 'session_refresh',
          oldSessionId: currentSession.id
        }
      }
    })

    return NextResponse.json({
      message: 'Session refreshed successfully',
      expiresAt: expiresAt.toISOString()
    })

  } catch (error) {
    console.error('Session refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
