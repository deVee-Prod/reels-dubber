import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get('session_access')?.value

  // 1. רשימת "שחרור מהיר" - כל אלה חייבים לעבור כדי שלא יהיה 404
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/login') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') // שוחרר קבצים כמו לוגו ותמונות
  ) {
    return NextResponse.next()
  }

  // 2. אם המשתמש מנסה להיכנס לדף הבית ואין לו עוגייה
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // 3. אם יש עוגייה - שחרר לדף הבית
  return NextResponse.next()
}

// הגדרת ה-Matcher בצורה הכי בטוחה שיש
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}