import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session_access')?.value
  const { pathname } = request.nextUrl

  // רשימת דפים שמותר להיכנס אליהם בלי סיסמה
  if (
    pathname.startsWith('/login') || 
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // בדיקה אם הסיסמה בעוגייה תואמת לסיסמה שהגדרת ב-Vercel
  if (session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // החלה של ה-Middleware על כל הדפים חוץ מקבצים סטטיים
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}