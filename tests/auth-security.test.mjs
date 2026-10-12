import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import {
  signSessionPayload,
  verifySessionCookie,
  getSessionSigningSecret,
  hasAdminRole,
  SUPER_ADMIN_EMAILS,
  COOKIE_NAME,
} from '../lib/auth.ts';
import {
  getLocalTestSession,
  LOCAL_TEST_EMAIL,
} from '../lib/local-test-auth.ts';
import { GET, POST } from '../app/api/auth/session/route.ts';

test('signs and verifies legitimate session cookies', () => {
  const original = { email: 'student@srmap.edu.in', fullName: 'SRM Student' };
  const signed = signSessionPayload(original);

  assert.ok(signed.includes('.'), 'Signed cookie must contain payload.signature');
  const verified = verifySessionCookie(signed);
  assert.ok(verified, 'Cookie should verify successfully');
  assert.equal(verified?.email, 'student@srmap.edu.in');
  assert.equal(verified?.fullName, 'SRM Student');
});

test('rejects tampered or corrupted HMAC signatures', () => {
  const original = { email: 'student@srmap.edu.in', fullName: 'SRM Student' };
  const signed = signSessionPayload(original);
  const [payloadBase64] = signed.split('.');

  // Forged signature
  const tamperedSig = `${payloadBase64}.invalid_signature_bits`;
  assert.equal(verifySessionCookie(tamperedSig), null);

  // Modified payload with original signature
  const attackerPayload = Buffer.from(
    JSON.stringify({ email: 'superadmin@srmap.edu.in' })
  ).toString('base64url');
  const forged = `${attackerPayload}.${signed.split('.')[1]}`;
  assert.equal(verifySessionCookie(forged), null);
});

test('rejects unsigned raw JSON cookies in production', () => {
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const rawCookie = encodeURIComponent(
      JSON.stringify({ email: 'qiskitfallfest@srmap.edu.in', isAdmin: true })
    );
    const result = verifySessionCookie(rawCookie);
    assert.equal(
      result,
      null,
      'Unsigned raw cookie must be rejected in production'
    );
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('rejects expired session cookies', () => {
  const pastIat = Math.floor(Date.now() / 1000) - 2000;
  const expiredExp = Math.floor(Date.now() / 1000) - 10; // Expired 10 seconds ago
  const expiredCookie = signSessionPayload({
    email: 'student@srmap.edu.in',
    iat: pastIat,
    exp: expiredExp,
  });

  const verified = verifySessionCookie(expiredCookie);
  assert.equal(verified, null, 'Expired session cookie must be rejected');
});

test('rejects future-dated session tokens beyond allowable skew', () => {
  const futureIat = Math.floor(Date.now() / 1000) + 600; // 10 minutes in future
  const futureCookie = signSessionPayload({
    email: 'student@srmap.edu.in',
    iat: futureIat,
    exp: futureIat + 3600,
  });

  const verified = verifySessionCookie(futureCookie);
  assert.equal(verified, null, 'Tokens issued far in the future must be rejected');
});

test('validates session payload schema strictly', () => {
  const secret = getSessionSigningSecret();

  // Non-object payload
  const bad1 = Buffer.from(JSON.stringify('not-an-object')).toString('base64url');
  assert.equal(verifySessionCookie(`${bad1}.sig`), null);

  // Invalid email format (missing @)
  const bad2 = signSessionPayload({ email: 'invalid-email-no-at' });
  assert.equal(verifySessionCookie(bad2), null);
});

test('fails safely in production when SESSION_SECRET is missing or under 32 characters', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.SESSION_SECRET;
  const prevAuth = process.env.AUTH_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    delete process.env.AUTH_SECRET;

    assert.equal(getSessionSigningSecret(), '');
    assert.throws(
      () => signSessionPayload({ email: 'test@example.com' }),
      /SESSION_SECRET must be configured/
    );
    assert.equal(verifySessionCookie('some.cookie'), null);

    // Short secret (< 32 chars) rejected in production
    process.env.SESSION_SECRET = 'short_secret_under_32';
    assert.equal(getSessionSigningSecret(), '');
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.SESSION_SECRET = prevSecret;
    process.env.AUTH_SECRET = prevAuth;
  }
});

test('never falls back to SUPABASE_SERVICE_ROLE_KEY for session signing', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.SESSION_SECRET;
  const prevAuth = process.env.AUTH_SECRET;
  const prevRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    delete process.env.AUTH_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'super_secret_supabase_service_role_key_that_is_long';

    // Must NOT use service role key in production
    assert.equal(getSessionSigningSecret(), '');
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.SESSION_SECRET = prevSecret;
    process.env.AUTH_SECRET = prevAuth;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevRole;
  }
});

test('super admin emails are verified on server and not client-controlled', () => {
  assert.ok(SUPER_ADMIN_EMAILS.includes('qiskitfallfest@srmap.edu.in'));
  assert.ok(SUPER_ADMIN_EMAILS.includes('gyankumar_sah@srmap.edu.in'));
  assert.equal(SUPER_ADMIN_EMAILS.includes('attacker@example.com'), false);
  assert.equal(SUPER_ADMIN_EMAILS.includes(LOCAL_TEST_EMAIL), false);
});

test('hasAdminRole helper correctly verifies admin permissions', () => {
  assert.equal(hasAdminRole(null), false);
  assert.equal(hasAdminRole({ email: 'user@srmap.edu.in', role: 'participant', isAdmin: false, fullName: 'User' }), false);
  assert.equal(hasAdminRole({ email: 'user@srmap.edu.in', role: 'admin', isAdmin: true, fullName: 'Admin' }), true);
  assert.equal(hasAdminRole({ email: 'qiskitfallfest@srmap.edu.in', role: 'participant', isAdmin: false, fullName: 'Admin' }), true);
});

test('local-test session never grants admin and cannot impersonate real users', () => {
  const session = getLocalTestSession();
  assert.equal(session.isAdmin, false);
  assert.equal(session.role, 'tester');
  assert.equal(session.email, LOCAL_TEST_EMAIL);
  assert.ok(
    session.email.endsWith('.invalid'),
    'Synthetic email must end with .invalid domain'
  );
  assert.equal(
    SUPER_ADMIN_EMAILS.includes(session.email),
    false,
    'Local test session cannot match any super admin'
  );
});

// ── Route Handler Lifecycle Tests ─────────────────────────────────────────────

test('route handler GET: unauthenticated request returns authenticated=false', async () => {
  const req = new NextRequest('http://localhost:3000/api/auth/session');
  const res = await GET(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, false);
  assert.equal(data.session, null);
});

test('route handler GET: valid signed session cookie returns authenticated=true', async () => {
  const signed = signSessionPayload({ email: 'qiskitfallfest@srmap.edu.in', fullName: 'Super Admin' });
  const req = new NextRequest('http://localhost:3000/api/auth/session', {
    headers: { cookie: `${COOKIE_NAME}=${signed}` },
  });
  const res = await GET(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, true);
  assert.equal(data.session?.email, 'qiskitfallfest@srmap.edu.in');
  assert.equal(data.session?.isAdmin, true);
});

test('route handler GET: expired signed session cookie returns authenticated=false', async () => {
  const expired = signSessionPayload({
    email: 'qiskitfallfest@srmap.edu.in',
    iat: Math.floor(Date.now() / 1000) - 2000,
    exp: Math.floor(Date.now() / 1000) - 100,
  });
  const req = new NextRequest('http://localhost:3000/api/auth/session', {
    headers: { cookie: `${COOKIE_NAME}=${expired}` },
  });
  const res = await GET(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, false);
  assert.equal(data.session, null);
});

test('route handler POST: requires authentication token in production', async () => {
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const req = new NextRequest('https://qffsrmap2026.com/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'attacker@evil.com' }),
    });
    const res = await POST(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, 'Authentication token required.');
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('regression test: client-forged isAdmin or role flags in cookie or session object cannot grant admin access', async () => {
  // 1. Client creates signed cookie with forged isAdmin: true and role: 'admin' for a non-superadmin email
  const forgedPayload = {
    email: 'normal_student@srmap.edu.in',
    fullName: 'Normal Student',
    role: 'admin',
    isAdmin: true,
  };
  const forgedCookie = signSessionPayload(forgedPayload);

  // 2. Cookie verification drops any role or isAdmin claims
  const verified = verifySessionCookie(forgedCookie);
  assert.ok(verified);
  assert.equal(verified.email, 'normal_student@srmap.edu.in');
  assert.equal(verified.role, undefined, 'Cookie verification must never pass through role');
  assert.equal(verified.isAdmin, undefined, 'Cookie verification must never pass through isAdmin');

  // 3. Directly passing a forged session object with synthetic email to hasAdminRole is denied
  const fakeSession = {
    email: LOCAL_TEST_EMAIL,
    fullName: 'Local Tester',
    role: 'admin',
    isAdmin: true,
  };
  assert.equal(hasAdminRole(fakeSession), false, 'Synthetic local test user cannot have admin role even if object claims it');

  // 4. GET /api/auth/session route handler re-derives admin status strictly on the server
  const req = new NextRequest('http://localhost:3000/api/auth/session', {
    headers: { cookie: `${COOKIE_NAME}=${forgedCookie}` },
  });
  const res = await GET(req);
  const data = await res.json();
  if (data.authenticated) {
    assert.equal(data.session.isAdmin, false, 'Client cannot escalate to admin via forged cookie payload');
    assert.notEqual(data.session.role, 'admin');
  } else {
    assert.equal(data.authenticated, false);
    assert.equal(data.session, null);
  }
});
