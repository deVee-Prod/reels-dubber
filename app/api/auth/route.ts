import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.ADMIN_PASSWORD;

    if (password === correctPassword) {
      const response = NextResponse.json({ success: true });
      
      // הגדרות עוגייה קשיחות ל-Vercel 2026
      response.cookies.set('session_access', password, {
  httpOnly: true,
  secure: true, 
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
});
      
      return response;
    }

    return NextResponse.json({ success: false }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}