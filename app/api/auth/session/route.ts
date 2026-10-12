import { NextRequest, NextResponse } from 'next/server.js';
import { isEmailWhitelisted } from '../../../../lib/redis.ts';
import {
  SUPER_ADMIN_EMAILS,
  COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSessionPayload,
  verifySessionCookie,
} from '../../../../lib/auth.ts';
import { getLocalTestSession, isLocalTestAuthEnabled } from '../../../../lib/local-test-auth.ts';
import { supabase } from '../../../../lib/supabase.ts';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (
    isLocalTestAuthEnabled(request.headers.get('host'), undefined, undefined, {
      xForwardedHost: request.headers.get('x-forwarded-host'),
      xForwardedFor: request.headers.get('x-forwarded-for'),
    })
  ) {
    return NextResponse.json({ authenticated: true, session: getLocalTestSession() });
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return NextResponse.json({ authenticated: false, session: null });
  }

  try {
    const verified = verifySessionCookie(sessionCookie.value);
    if (!verified || !verified.email) {
      return NextResponse.json({ authenticated: false, session: null });
    }

    const email = verified.email.trim().toLowerCase();
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);
    const whitelist = await isEmailWhitelisted(email);

    if (!isSuperAdmin && !whitelist.whitelisted) {
      return NextResponse.json({ authenticated: false, session: null });
    }

    const role = isSuperAdmin ? 'admin' : whitelist.role || 'participant';

    return NextResponse.json({
      authenticated: true,
      session: {
        email,
        fullName: verified.fullName || whitelist.fullName || email.split('@')[0],
        role,
        isAdmin: isSuperAdmin || role === 'admin',
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false, session: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (
      isLocalTestAuthEnabled(request.headers.get('host'), undefined, undefined, {
        xForwardedHost: request.headers.get('x-forwarded-host'),
        xForwardedFor: request.headers.get('x-forwarded-for'),
      })
    ) {
      return NextResponse.json({ success: true, session: getLocalTestSession() });
    }

    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim() || '';
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // In production, require verified authentication token to prevent unauthorized session creation
    if (accessToken) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(accessToken);
      if (authError || !user || user.email?.trim().toLowerCase() !== email) {
        return NextResponse.json(
          { error: 'Invalid or expired authentication token.' },
          { status: 401 }
        );
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Authentication token required.' },
        { status: 401 }
      );
    }

    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);
    const whitelist = await isEmailWhitelisted(email);

    if (!isSuperAdmin && !whitelist.whitelisted) {
      return NextResponse.json(
        {
          error:
            'You are not eligible participant. Please register in Unstop and check back after few hours.',
          registrationUrl:
            'https://unstop.com/college-fests/qiskit-fall-fest-srmap-2026-srm-university-amaravati-515345',
        },
        { status: 403 }
      );
    }

    const role = isSuperAdmin ? 'admin' : whitelist.role || 'participant';
    const sessionData = {
      email,
      fullName: fullName || whitelist.fullName || email.split('@')[0],
      role,
      isAdmin: isSuperAdmin || role === 'admin',
    };

    const cookieValue = signSessionPayload(sessionData);

    const response = NextResponse.json({
      success: true,
      session: sessionData,
    });

    function getCookieDomain(req: NextRequest): string | undefined {
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.hostname;
      if (host && host.includes('qffsrmap2026.com')) {
        return '.qffsrmap2026.com';
      }
      return undefined;
    }

    function isRequestSecure(req: NextRequest): boolean {
      const proto = req.headers.get('x-forwarded-proto');
      if (proto) {
        return proto === 'https';
      }
      return req.nextUrl.protocol === 'https:';
    }

    const isSecure = isRequestSecure(request);
    const domain = getCookieDomain(request);

    // Set signed cookie for 14 days
    response.cookies.set({
      name: COOKIE_NAME,
      value: cookieValue,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
      ...(domain ? { domain } : {}),
    });

    return response;
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate session' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out' });

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.hostname;
  const domain = host && host.includes('qffsrmap2026.com') ? '.qffsrmap2026.com' : undefined;
  const proto = request.headers.get('x-forwarded-proto');
  const isSecure = proto ? proto === 'https' : request.nextUrl.protocol === 'https:';

  // Clear host-only cookie
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  // Also clear shared domain cookie if applicable
  if (domain) {
    response.cookies.set({
      name: COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      domain,
      maxAge: 0,
    });
  }

  return response;
}
