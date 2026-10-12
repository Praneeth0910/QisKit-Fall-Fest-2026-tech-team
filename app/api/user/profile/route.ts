import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { invalidateEmailCache, invalidateHackathonTeamCache } from '@/lib/redis';

const COOKIE_NAME = 'qff_auth_session';

export const runtime = 'nodejs';

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

/**
 * PATCH /api/user/profile
 * Allows authenticated user to update their official Full Name.
 * Updates:
 * 1. public.allowed_emails.full_name
 * 2. public.team_members.full_name
 * 3. public.hackathon_teams.lead_name (if team leader)
 * 4. Invalidates Redis cache for email & hackathon team
 * 5. Updates session cookie so user sees immediate reflection across portal
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawFullName = body?.fullName;

    if (typeof rawFullName !== 'string') {
      return NextResponse.json({ error: 'Valid full name is required.' }, { status: 400 });
    }

    const cleanFullName = rawFullName.trim().replace(/\s+/g, ' ');

    if (cleanFullName.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters.' }, { status: 400 });
    }

    if (cleanFullName.length > 70) {
      return NextResponse.json({ error: 'Name cannot exceed 70 characters.' }, { status: 400 });
    }

    const email = session.email.toLowerCase();

    // 1. Update allowed_emails
    const { error: whitelistErr } = await supabase
      .from('allowed_emails')
      .update({ full_name: cleanFullName })
      .ilike('email', email);

    if (whitelistErr) {
      console.warn('[User Profile] Error updating allowed_emails:', whitelistErr.message);
    }

    // 2. Update team_members (all teams where this user is leader or member)
    const { error: memberErr } = await supabase
      .from('team_members')
      .update({ full_name: cleanFullName })
      .ilike('email', email);

    if (memberErr) {
      console.warn('[User Profile] Error updating team_members:', memberErr.message);
    }

    // 3. Update hackathon_teams lead_name if this user is a team lead
    const { error: teamErr } = await supabase
      .from('hackathon_teams')
      .update({ lead_name: cleanFullName, updated_at: new Date().toISOString() })
      .ilike('lead_email', email);

    if (teamErr) {
      console.warn('[User Profile] Error updating hackathon_teams lead_name:', teamErr.message);
    }

    // 4. Invalidate Redis caches
    await invalidateEmailCache(email);
    await invalidateHackathonTeamCache(email);

    // 5. Build refreshed session payload
    const updatedSession = {
      email,
      fullName: cleanFullName,
      role: session.role,
      isAdmin: session.isAdmin,
    };

    const response = NextResponse.json({
      success: true,
      message: 'Full name successfully updated.',
      fullName: cleanFullName,
      session: updatedSession,
    });

    // 6. Update session cookie
    const isSecure = isRequestSecure(request);
    const domain = getCookieDomain(request);

    response.cookies.set({
      name: COOKIE_NAME,
      value: encodeURIComponent(JSON.stringify(updatedSession)),
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
      ...(domain ? { domain } : {}),
    });

    return response;
  } catch (error: any) {
    console.error('[User Profile] Failed to update profile:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update profile.' },
      { status: 500 }
    );
  }
}
