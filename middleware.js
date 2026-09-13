import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request) {
  // Las rutas /ver/:token son públicas — no requieren sesión
  if (request.nextUrl.pathname.startsWith('/ver/')) {
    return;
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
