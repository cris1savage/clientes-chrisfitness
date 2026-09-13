import { NextResponse } from 'next/server';

// Middleware simplificado — solo gestiona cookies de sesión de Supabase
// sin depender de @supabase/ssr en el Edge Runtime
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Rutas públicas
  if (
    pathname.startsWith('/ver/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Leer la cookie de sesión de Supabase directamente
  const cookieName = request.cookies
    .getAll()
    .find((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))?.name;

  const hasSession = !!cookieName;
  const isAuthRoute = pathname.startsWith('/login');

  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/clientes';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
