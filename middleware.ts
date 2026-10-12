import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Create a new ratelimiter that allows 10 requests per 10 seconds for /api/*
const ratelimit =
  redisUrl && redisToken
    ? new Ratelimit({
        redis: new Redis({
          url: redisUrl,
          token: redisToken,
        }),
        limiter: Ratelimit.slidingWindow(10, '10 s'),
        analytics: true,
      })
    : null;
import { getTrustedClientIp } from './lib/client-ip';

export { getTrustedClientIp };

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── 1. API Rate Limiting ───────────────────────────────────────────────────
  if (pathname.startsWith('/api')) {
    if (ratelimit) {
      const ip = getTrustedClientIp(request);
      const { success, limit, reset, remaining } = await ratelimit.limit(ip);

      if (!success) {
        return new NextResponse(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Content-Type': 'application/json',
          },
        });
      }

      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Limit', limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', reset.toString());
      return response;
    }
  }

  // ─── 2. Learning Portal Route Handling ─────────────────────────────────────
  // The learning portal relies on the client-side AuthGate and cryptographic
  // server-side session validation (getServerSession() in API routes & server components).
  //
  // Cryptographic HMAC signature verification, clock-skew checks, and Redis
  // email whitelisting cannot be fully verified in Edge middleware without
  // introducing unnecessary latency, external dependencies, or breaking
  // client-side OAuth callbacks (which convey tokens in URL hash fragments).
  // Furthermore, mere cookie presence does not constitute proof of authentication.
  //
  // We preserve the established AuthGate flow and ensure learning portal pages
  // are never cached by intermediate proxies or CDNs.
  if (pathname === '/learning' || pathname.startsWith('/learning/')) {
    const response = NextResponse.next();
    response.headers.set(
      'Cache-Control',
      'private, no-cache, no-store, max-age=0, must-revalidate'
    );
    response.headers.set('Pragma', 'no-cache');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Match API routes and all learning portal routes
  matcher: ['/api/:path*', '/learning', '/learning/:path*'],
};
