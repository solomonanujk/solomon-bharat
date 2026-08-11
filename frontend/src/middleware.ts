import { NextRequest, NextResponse } from 'next/server';
import type { Role } from '@/modules/auth/types';

const REFRESH_COOKIE_NAME = 'refresh_token';
// Middleware runs server-side, so it talks to the backend directly rather than through the
// same-origin /api rewrite (that rewrite exists for the browser's cookie scoping, not for this).
const API_URL = `${process.env.BACKEND_ORIGIN ?? 'http://localhost:4000'}/api/v1`;

function roleForPath(pathname: string): Role | null {
  if (pathname === '/seller' || pathname.startsWith('/seller/')) return 'SELLER';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'SUPER_ADMIN';

  const buyerPrefixes = ['/dashboard', '/orders', '/wishlist', '/messages', '/profile', '/checkout'];
  if (buyerPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return 'BUYER';
  }

  return null;
}

/**
 * The access token lives only in browser memory (never persisted), so middleware — which runs
 * server-side on the Edge runtime — has no way to read it. It instead asks the backend's
 * read-only /auth/session endpoint to validate the httpOnly refresh cookie without rotating it,
 * so this check can't desync the browser's session state.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requiredRole = roleForPath(pathname);
  if (!requiredRole) {
    return NextResponse.next();
  }

  const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!refreshToken) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const res = await fetch(`${API_URL}/auth/session`, {
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` },
    });

    if (!res.ok) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const body = (await res.json()) as { data?: { user?: { role?: Role } } };
    if (body.data?.user?.role !== requiredRole) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/orders/:path*',
    '/wishlist/:path*',
    '/messages/:path*',
    '/profile/:path*',
    '/checkout/:path*',
    '/seller/:path*',
    '/admin/:path*',
  ],
};
