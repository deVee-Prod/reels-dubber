import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get('session_access')?.value

  // שחרור מוחלט של קבצים סטטיים ודף הלוגין
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/login') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // בדיקת סיסמה
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    // חשוב: משתמשים בכתובת מוחלטת כדי למנוע לופים
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}