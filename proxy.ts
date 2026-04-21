import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const session = request.cookies.get('session_access')?.value
  const { pathname } = request.nextUrl

  // מאפשר גישה חופשית ללוגין ולאימות
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/login') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // אם אין סיסמה תקינה, זרוק ללוגין
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

// חשוב: בגרסה הזו מייצאים את הקונפיג ככה
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}