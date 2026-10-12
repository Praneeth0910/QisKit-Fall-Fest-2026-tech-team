import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signSessionPayload,
  verifySessionCookie,
  SUPER_ADMIN_EMAILS,
} from '../lib/auth.ts';
import {
  isLocalTestAuthEnabled,
  isLoopbackHost,
  isProductionOrCloudEnvironment,
} from '../lib/local-test-auth-policy.ts';
import {
  getLocalTestSession,
  LOCAL_TEST_EMAIL,
} from '../lib/local-test-auth.ts';
import { dispatchJudgeEvaluation } from '../lib/qiskit-judge.ts';
import { evaluateProblemWithTypeScript } from '../lib/qiskit-evaluator-ts.ts';

// ── 1. Unauthenticated and Invalid Session Tests ──────────────────────────────

test('unauthenticated request: missing or null session cookie yields null session', () => {
  assert.equal(verifySessionCookie(null), null);
  assert.equal(verifySessionCookie(undefined), null);
  assert.equal(verifySessionCookie(''), null);
});

test('invalid/forged session: tampered cookie yields null session', () => {
  const legitCookie = signSessionPayload({
    email: 'student@srmap.edu.in',
    fullName: 'SRM Participant',
  });
  const parts = legitCookie.split('.');
  const tamperedCookie = `${parts[0]}.wrongsignature12345`;
  assert.equal(verifySessionCookie(tamperedCookie), null);
});

test('forged admin session: unsigned cookie rejected in production', () => {
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const rawAttackerCookie = encodeURIComponent(
      JSON.stringify({
        email: 'qiskitfallfest@srmap.edu.in',
        isAdmin: true,
        role: 'admin',
      })
    );
    assert.equal(verifySessionCookie(rawAttackerCookie), null);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

// ── 2. Authenticated Participant vs Admin Access ──────────────────────────────

test('authenticated participant session derives role correctly without privilege escalation', () => {
  const participantPayload = {
    email: 'participant@srmap.edu.in',
    fullName: 'Alice Participant',
  };
  const cookie = signSessionPayload(participantPayload);
  const verified = verifySessionCookie(cookie);
  assert.ok(verified);
  assert.equal(verified?.email, 'participant@srmap.edu.in');

  // Verify that an attacker inserting isAdmin: true into signed payload does not make them admin
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(verified.email);
  assert.equal(isSuperAdmin, false);
});

test('valid administrator access: verified super admin receives admin role', () => {
  for (const adminEmail of SUPER_ADMIN_EMAILS) {
    const adminCookie = signSessionPayload({ email: adminEmail, fullName: 'Fest Admin' });
    const verified = verifySessionCookie(adminCookie);
    assert.ok(verified);
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(verified.email);
    assert.equal(isSuperAdmin, true, `${adminEmail} must be recognized as super admin`);
  }
});

// ── 3. Cross-User Submission and Admin Authorization Checks ───────────────────

test('cross-user submission access denial logic', () => {
  const userA = 'alice@srmap.edu.in';
  const userB = 'bob@srmap.edu.in';
  const admin = SUPER_ADMIN_EMAILS[0];

  function canAccessSubmission(viewerEmail, isAdmin, submissionOwnerEmail) {
    const normViewer = viewerEmail.trim().toLowerCase();
    const normOwner = submissionOwnerEmail.trim().toLowerCase();
    return normViewer === normOwner || isAdmin;
  }

  // Owner can view own submission
  assert.equal(canAccessSubmission(userA, false, userA), true);
  assert.equal(canAccessSubmission(userB, false, userB), true);

  // Cross-user access denied
  assert.equal(canAccessSubmission(userA, false, userB), false);
  assert.equal(canAccessSubmission(userB, false, userA), false);

  // Admin can view any submission
  assert.equal(canAccessSubmission(admin, true, userA), true);
  assert.equal(canAccessSubmission(admin, true, userB), true);
});

test('non-admin access denial for administrative quiz modifications', () => {
  function canModifyQuizzes(session) {
    return Boolean(session && session.isAdmin);
  }

  const unauthenticated = null;
  const participant = { email: 'alice@srmap.edu.in', isAdmin: false };
  const admin = { email: SUPER_ADMIN_EMAILS[0], isAdmin: true };

  assert.equal(canModifyQuizzes(unauthenticated), false);
  assert.equal(canModifyQuizzes(participant), false);
  assert.equal(canModifyQuizzes(admin), true);
});

// ── 4. Production vs Local-Test Authentication Isolation ──────────────────────

test('production attempts to enable local-test authentication fail completely', () => {
  // Even with loopback host and optIn=true, production environment rejects local-test auth
  assert.equal(isLocalTestAuthEnabled('localhost:3000', 'production', 'true'), false);
  assert.equal(isLocalTestAuthEnabled('127.0.0.1:3000', 'production', 'true'), false);

  // Vercel deployment indicators reject
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', { vercelEnv: 'production' }),
    false
  );
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', { isVercel: '1' }),
    false
  );

  // External / non-loopback host rejected
  assert.equal(isLocalTestAuthEnabled('qffsrmap2026.com', 'development', 'true'), false);
  assert.equal(isLocalTestAuthEnabled('192.168.1.10:3000', 'development', 'true'), false);

  // Forwarded headers from internet rejected
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', {
      xForwardedHost: 'external.example.com',
    }),
    false
  );
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', {
      xForwardedFor: '198.51.100.22',
    }),
    false
  );
});

test('local-test authentication only permitted on explicit local loopback configuration', () => {
  // Disabled by default
  assert.equal(isLocalTestAuthEnabled('localhost:3000', 'development', undefined), false);
  assert.equal(isLocalTestAuthEnabled('localhost:3000', 'development', 'false'), false);

  // Explicit opt-in on loopback
  assert.equal(isLocalTestAuthEnabled('localhost:3000', 'development', 'true'), true);
  assert.equal(isLocalTestAuthEnabled('127.0.0.1:3000', 'development', 'true'), true);
  assert.equal(isLocalTestAuthEnabled('[::1]:3000', 'development', 'true'), true);

  // Synthetic identity properties
  const testSession = getLocalTestSession();
  assert.equal(testSession.isAdmin, false);
  assert.equal(testSession.role, 'tester');
  assert.equal(testSession.email, LOCAL_TEST_EMAIL);
  assert.ok(testSession.email.endsWith('.invalid'));
});

// ── 5. Judge Requests with Missing or Invalid Secrets ─────────────────────────

test('remote judge requests fail closed when shared secret is absent in production/configured', async () => {
  const prevUrl = process.env.QISKIT_JUDGE_URL;
  const prevSecret = process.env.QISKIT_JUDGE_SECRET;

  try {
    process.env.QISKIT_JUDGE_URL = 'http://localhost:8000';
    delete process.env.QISKIT_JUDGE_SECRET;

    const result = await dispatchJudgeEvaluation('P1', 'pass', 'run');
    assert.equal(result.success, false);
    assert.equal(result.score, 0);
    assert.ok(
      result.error_message?.includes('Judge authentication secret is not configured'),
      'Must fail closed with explicit secret error'
    );
  } finally {
    process.env.QISKIT_JUDGE_URL = prevUrl;
    process.env.QISKIT_JUDGE_SECRET = prevSecret;
  }
});

test('production cannot silently use non-authoritative TypeScript evaluator', async () => {
  const prevEnv = process.env.NODE_ENV;
  const prevTsFallback = process.env.ENABLE_TYPESCRIPT_JUDGE_FALLBACK;
  const prevJudgeUrl = process.env.QISKIT_JUDGE_URL;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.QISKIT_JUDGE_URL;
    process.env.ENABLE_TYPESCRIPT_JUDGE_FALLBACK = 'true';

    const result = await dispatchJudgeEvaluation('P9', 'pass', 'run');
    assert.equal(result.success, false);
    assert.equal(result.score, 0);
    assert.ok(
      result.error_message?.includes('No authoritative judge'),
      'Must fail closed in production rather than silently using TypeScript evaluator'
    );
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.ENABLE_TYPESCRIPT_JUDGE_FALLBACK = prevTsFallback;
    process.env.QISKIT_JUDGE_URL = prevJudgeUrl;
  }
});

// ── 6. Evaluation Logic: P9 Preservation & Failed Submission Score Zero ────────

test('regression check: failed submissions receive zero points', async () => {
  const brokenCode = `def qaoa_maxcut(n, edges, p):
    raise ValueError("Intentional syntax or logic failure")
`;
  const result = await evaluateProblemWithTypeScript('P9', brokenCode, 'submit');
  assert.equal(result.success, false);
  assert.equal(result.score, 0, 'Failed submission must receive exactly 0 points');
  assert.equal(result.passed_tests, 0);
  assert.ok(result.error_message !== null);
});

test('regression check: valid P9 submission evaluates successfully to 18/18', async () => {
  const validP9Code = `from qiskit import QuantumCircuit

def qaoa_maxcut(n, edges, p):
    qc = QuantumCircuit(n, n)
    for q in range(n):
        qc.h(q)
    for l in range(p):
        for u, v, w in edges:
            qc.rzz(0.8 * w, u, v)
        for q in range(n):
            qc.rx(0.6, q)
    for q in range(n):
        qc.measure(q, q)
    return qc
`;
  const result = await evaluateProblemWithTypeScript('P9', validP9Code, 'submit');
  assert.equal(result.success, true);
  assert.equal(result.score, 18, 'P9 solution must receive full 18 points');
  assert.equal(result.max_score, 18);
  assert.equal(result.passed_tests, result.total_tests);
  assert.ok(result.total_tests >= 4, 'Must evaluate both public and hidden test cases');
  assert.equal(result.error_message, null);
});
