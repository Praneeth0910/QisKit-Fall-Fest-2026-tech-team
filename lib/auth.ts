import { cookies } from 'next/headers';
import { isEmailWhitelisted } from './redis';

export const SUPER_ADMIN_EMAILS = [
  'qiskitfallfest@srmap.edu.in',
  'gyankumar_sah@srmap.edu.in',
];

export interface AuthSession {
  email: string;
  fullName: string;
  role: 'participant' | 'admin' | 'tester' | 'mentor';
  isAdmin: boolean;
}

const COOKIE_NAME = 'qff_auth_session';

/**
 * Server-side helper to get the currently authenticated learning session.
 */
export async function getServerSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(sessionCookie.value)) as {
      email: string;
      fullName?: string;
    };

    if (!parsed.email) return null;

    const email = parsed.email.trim().toLowerCase();
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);

    // Verify whitelist in Redis/Supabase
    const whitelist = await isEmailWhitelisted(email);

    if (!isSuperAdmin && !whitelist.whitelisted) {
      return null;
    }

    const role = isSuperAdmin
      ? 'admin'
      : (whitelist.role as AuthSession['role']) || 'participant';

    const isCleanWhitelistName =
      Boolean(whitelist.fullName) &&
      !whitelist.fullName!.includes('|') &&
      !/^\d{5,}-/.test(whitelist.fullName!);

    const resolvedFullName =
      (parsed.fullName && !parsed.fullName.includes('|'))
        ? parsed.fullName
        : (isCleanWhitelistName ? whitelist.fullName! : (parsed.fullName || whitelist.fullName || email.split('@')[0]));

    return {
      email,
      fullName: resolvedFullName,
      role,
      isAdmin: isSuperAdmin || role === 'admin',
    };
  } catch {
    return null;
  }
}
