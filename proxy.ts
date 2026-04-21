import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get('session_access')?.value

  // אם אנחנו כבר בדף לוגין או ב-API, אל תעשה כלום
  if (pathname.startsWith('/login') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // אם אין סשן, תפנה ללוגין
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    console.log("Redirecting to login from:", pathname)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  //Matcher מעודכן ל-2026
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}