import crypto from 'crypto';
import { cookies } from 'next/headers.js';
import { isEmailWhitelisted } from './redis.ts';
import { getLocalTestSession, isLocalTestAuthRequest } from './local-test-auth.ts';

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

export const COOKIE_NAME = 'qff_auth_session';

export const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // 14 days in seconds

export interface SignedSessionPayload {
  email: string;
  fullName?: string;
  iat: number;
  exp: number;
}

let devFallbackWarned = false;

export function getSessionSigningSecret(): string {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== 'production'
      ? 'qff-development-fallback-session-secret-key-32chars!'
      : '');

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      return '';
    }
  } else if (!process.env.SESSION_SECRET && !process.env.AUTH_SECRET && !devFallbackWarned) {
    devFallbackWarned = true;
    console.warn(
      '[AUTH] Notice: Using development-only fallback session key. SESSION_SECRET must be configured with a 32+ char secret in production.'
    );
  }

  return secret;
}

export function signSessionPayload(data: {
  email: string;
  fullName?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}): string {
  const secret = getSessionSigningSecret();
  if (!secret) {
    throw new Error(
      'SESSION_SECRET must be configured with a cryptographically strong key (min 32 chars) for session signing in production.'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const payloadToSign: SignedSessionPayload = {
    email: data.email.trim().toLowerCase(),
    ...(data.fullName ? { fullName: String(data.fullName).trim().slice(0, 100) } : {}),
    iat: typeof data.iat === 'number' && Number.isFinite(data.iat) ? data.iat : now,
    exp:
      typeof data.exp === 'number' && Number.isFinite(data.exp)
        ? data.exp
        : now + SESSION_MAX_AGE_SECONDS,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payloadToSign)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');
  return `${payloadBase64}.${signature}`;
}

export function verifySessionCookie(
  cookieValue: string | null | undefined
): { email: string; fullName?: string } | null {
  if (!cookieValue) return null;
  const secret = getSessionSigningSecret();
  if (!secret) return null;

  // If signed format (payload.signature)
  if (cookieValue.includes('.')) {
    const parts = cookieValue.split('.');
    if (parts.length !== 2) return null;
    const [payloadBase64, providedSig] = parts;
    if (!payloadBase64 || !providedSig) return null;

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64url');

    const providedBuf = Buffer.from(providedSig);
    const expectedBuf = Buffer.from(expectedSig);
    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return null;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(payloadBase64, 'base64url').toString('utf8')
      );
      if (!decoded || typeof decoded !== 'object') {
        return null;
      }

      // 1. Validate email
      if (typeof decoded.email !== 'string') {
        return null;
      }
      const email = decoded.email.trim().toLowerCase();
      if (!email || !email.includes('@') || email.length > 254) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);

      // 2. Validate expiration claim (exp)
      if (typeof decoded.exp !== 'number' || !Number.isFinite(decoded.exp)) {
        return null;
      }
      if (decoded.exp <= now) {
        return null; // Expired cookie
      }

      // 3. Validate issued-at claim (iat) with 5-minute clock skew tolerance
      if (typeof decoded.iat === 'number' && Number.isFinite(decoded.iat)) {
        if (decoded.iat > now + 300) {
          return null; // Future-dated token
        }
      }

      return {
        email,
        fullName:
          typeof decoded.fullName === 'string'
            ? decoded.fullName.trim().slice(0, 100)
            : undefined,
      };
    } catch {
      return null;
    }
  }

  // Reject unsigned cookies in production to prevent cookie forgery
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Non-production fallback for legacy dev/test cookies
  try {
    const decoded = JSON.parse(decodeURIComponent(cookieValue));
    if (decoded && typeof decoded === 'object' && typeof decoded.email === 'string') {
      const email = decoded.email.trim().toLowerCase();
      if (email.includes('@')) {
        return {
          email,
          fullName:
            typeof decoded.fullName === 'string'
              ? decoded.fullName.trim().slice(0, 100)
              : undefined,
        };
      }
    }
  } catch {}

  return null;
}

export function hasAdminRole(session: AuthSession | null): boolean {
  if (!session || !session.email) return false;
  const email = session.email.trim().toLowerCase();
  if (email.endsWith('.invalid')) return false;
  if (SUPER_ADMIN_EMAILS.includes(email)) return true;
  return session.role === 'admin' && session.isAdmin === true;
}

/**
 * Server-side helper to get the currently authenticated learning session.
 */
export async function getServerSession(): Promise<AuthSession | null> {
  if (await isLocalTestAuthRequest()) {
    return getLocalTestSession();
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  try {
    const verified = verifySessionCookie(sessionCookie.value);
    if (!verified || !verified.email) return null;

    const email = verified.email.trim().toLowerCase();
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);

    // Verify whitelist in Redis/Supabase
    const whitelist = await isEmailWhitelisted(email);

    if (!isSuperAdmin && !whitelist.whitelisted) {
      return null;
    }

    const role = isSuperAdmin
      ? 'admin'
      : (whitelist.role as AuthSession['role']) || 'participant';

    return {
      email,
      fullName: verified.fullName || whitelist.fullName || email.split('@')[0],
      role,
      isAdmin: isSuperAdmin || role === 'admin',
    };
  } catch {
    return null;
  }
}
