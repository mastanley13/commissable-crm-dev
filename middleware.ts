import { NextRequest, NextResponse } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/login', '/register', '/api/auth/login', '/api/auth/register', '/api/auth/me', '/api/auth/logout']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const sessionToken = request.cookies.get('session-token')?.value

  if (!sessionToken) {
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)'
  ]
}
