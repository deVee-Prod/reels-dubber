import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get('session_access')

  // נתיבים פתוחים
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/login') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // אם ה-API כבר נתן לנו עוגייה, פשוט תן להיכנס
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}