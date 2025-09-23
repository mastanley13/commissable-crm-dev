import { NextResponse } from 'next/server'
import { checkDatabaseHealth } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await checkDatabaseHealth()
  const status = result.status === 'healthy' ? 200 : 500

  return NextResponse.json(result, { status })
}
