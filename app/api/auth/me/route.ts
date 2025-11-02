import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Debug: Log cookie information
    const sessionToken = request.cookies.get('session-token')
    console.log('🔍 /api/auth/me Debug:')
    console.log('  Session cookie present:', !!sessionToken)
    console.log('  Session token length:', sessionToken?.value?.length || 0)
    console.log('  Session token preview:', sessionToken?.value?.substring(0, 10) + '...' || 'None')

    const user = await getAuthenticatedUser()

    if (!user) {
      console.log('  ❌ Authentication failed: No user returned')
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('  ✅ Authentication successful')
    console.log('  User:', user.fullName)
    console.log('  Permissions:', user.role?.permissions.length || 0)
    
    const dataMgmtPerms = user.role?.permissions.filter(p => p.code.includes('data_management')) || []
    console.log('  Data Management Permissions:', dataMgmtPerms.length)
    dataMgmtPerms.forEach(p => console.log('    ✅', p.code))

    return NextResponse.json({ user })

  } catch (error) {
    console.error('Auth check error:', error)
    const payload: any = { error: 'Internal server error' }
    if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
      payload.detail = error.message
    }
    return NextResponse.json(payload, { status: 500 })
  }
}
