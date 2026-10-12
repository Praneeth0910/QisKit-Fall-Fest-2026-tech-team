import { NextRequest, NextResponse } from 'next/server';
import { isEmailWhitelisted } from '@/lib/redis';
import { SUPER_ADMIN_EMAILS } from '@/lib/auth';

const COOKIE_NAME = 'qff_auth_session';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return NextResponse.json({ authenticated: false, session: null });
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(sessionCookie.value));
    const email = parsed.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ authenticated: false, session: null });
    }

    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);
    const whitelist = await isEmailWhitelisted(email);

    if (!isSuperAdmin && !whitelist.whitelisted) {
      return NextResponse.json({ authenticated: false, session: null });
    }

    const role = isSuperAdmin ? 'admin' : whitelist.role || 'participant';

    const isCleanWhitelistName =
      Boolean(whitelist.fullName) &&
      !whitelist.fullName!.includes('|') &&
      !/^\d{5,}-/.test(whitelist.fullName!);

    const resolvedFullName =
      (parsed.fullName && !parsed.fullName.includes('|'))
        ? parsed.fullName
        : (isCleanWhitelistName ? whitelist.fullName! : (parsed.fullName || whitelist.fullName || email.split('@')[0]));

    return NextResponse.json({
      authenticated: true,
      session: {
        email,
        fullName: resolvedFullName,
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
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim() || '';

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
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
    const isCleanWhitelistName =
      Boolean(whitelist.fullName) &&
      !whitelist.fullName!.includes('|') &&
      !/^\d{5,}-/.test(whitelist.fullName!);

    const resolvedFullName =
      (fullName && !fullName.includes('|'))
        ? fullName
        : (isCleanWhitelistName ? whitelist.fullName! : (fullName || whitelist.fullName || email.split('@')[0]));

    const sessionData = {
      email,
      fullName: resolvedFullName,
      role,
      isAdmin: isSuperAdmin || role === 'admin',
    };

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

    // Set cookie for 14 days
    response.cookies.set({
      name: COOKIE_NAME,
      value: encodeURIComponent(JSON.stringify(sessionData)),
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
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
