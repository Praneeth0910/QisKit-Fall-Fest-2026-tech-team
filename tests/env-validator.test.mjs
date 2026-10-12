import test from 'node:test';
import assert from 'node:assert/strict';
import { validateServerEnvironment, _resetValidationForTesting } from '../lib/env-validator.ts';

test('env-validator: passes in development with fallback warnings and does not throw', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.SESSION_SECRET;
  const prevAuth = process.env.AUTH_SECRET;

  try {
    process.env.NODE_ENV = 'development';
    delete process.env.SESSION_SECRET;
    delete process.env.AUTH_SECRET;
    _resetValidationForTesting();

    const result = validateServerEnvironment();
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some((w) => w.includes('SESSION_SECRET is not configured')));
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevSecret) process.env.SESSION_SECRET = prevSecret;
    if (prevAuth) process.env.AUTH_SECRET = prevAuth;
    _resetValidationForTesting();
  }
});

test('env-validator: fails in production when SESSION_SECRET is missing or under 32 chars', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevPhase = process.env.NEXT_PHASE;
  const prevSecret = process.env.SESSION_SECRET;
  const prevAuth = process.env.AUTH_SECRET;
  const prevRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PHASE;
    delete process.env.SESSION_SECRET;
    delete process.env.AUTH_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'super_secret_supabase_role_key_value_here';
    _resetValidationForTesting();

    assert.throws(
      () => validateServerEnvironment(),
      /SESSION_SECRET \(or AUTH_SECRET\) must be set/
    );

    // Test secret under 32 chars
    _resetValidationForTesting();
    process.env.SESSION_SECRET = 'short_secret_under_32';
    assert.throws(
      () => validateServerEnvironment(),
      /SESSION_SECRET must be at least 32 characters/
    );
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.NEXT_PHASE = prevPhase;
    if (prevSecret) process.env.SESSION_SECRET = prevSecret;
    if (prevAuth) process.env.AUTH_SECRET = prevAuth;
    if (prevRole) process.env.SUPABASE_SERVICE_ROLE_KEY = prevRole;
    _resetValidationForTesting();
  }
});

test('env-validator: fails in production when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevPhase = process.env.NEXT_PHASE;
  const prevSecret = process.env.SESSION_SECRET;
  const prevRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PHASE;
    process.env.SESSION_SECRET = 'a_cryptographically_secure_session_secret_of_32_chars!';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    _resetValidationForTesting();

    assert.throws(
      () => validateServerEnvironment(),
      /SUPABASE_SERVICE_ROLE_KEY must be configured/
    );
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.NEXT_PHASE = prevPhase;
    if (prevSecret) process.env.SESSION_SECRET = prevSecret;
    if (prevRole) process.env.SUPABASE_SERVICE_ROLE_KEY = prevRole;
    _resetValidationForTesting();
  }
});

test('env-validator: fails in production when QISKIT_JUDGE_URL is set but QISKIT_JUDGE_SECRET is missing', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevPhase = process.env.NEXT_PHASE;
  const prevSecret = process.env.SESSION_SECRET;
  const prevRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevJudgeUrl = process.env.QISKIT_JUDGE_URL;
  const prevJudgeSecret = process.env.QISKIT_JUDGE_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PHASE;
    process.env.SESSION_SECRET = 'a_cryptographically_secure_session_secret_of_32_chars!';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'super_secret_supabase_role_key_value_here';
    process.env.QISKIT_JUDGE_URL = 'http://localhost:8000';
    delete process.env.QISKIT_JUDGE_SECRET;
    _resetValidationForTesting();

    assert.throws(
      () => validateServerEnvironment(),
      /QISKIT_JUDGE_SECRET must be configured in production/
    );
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.NEXT_PHASE = prevPhase;
    if (prevSecret) process.env.SESSION_SECRET = prevSecret;
    if (prevRole) process.env.SUPABASE_SERVICE_ROLE_KEY = prevRole;
    if (prevJudgeUrl) process.env.QISKIT_JUDGE_URL = prevJudgeUrl;
    if (prevJudgeSecret) process.env.QISKIT_JUDGE_SECRET = prevJudgeSecret;
    _resetValidationForTesting();
  }
});

test('env-validator: does not throw during static build phase even if runtime secrets are absent', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevPhase = process.env.NEXT_PHASE;
  const prevSecret = process.env.SESSION_SECRET;
  const prevRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PHASE = 'phase-production-build';
    delete process.env.SESSION_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    _resetValidationForTesting();

    // Should return valid: true without errors during static build phase
    const result = validateServerEnvironment();
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.NEXT_PHASE = prevPhase;
    if (prevSecret) process.env.SESSION_SECRET = prevSecret;
    if (prevRole) process.env.SUPABASE_SERVICE_ROLE_KEY = prevRole;
    _resetValidationForTesting();
  }
});

test('env-validator: never exposes secret values in error messages', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevPhase = process.env.NEXT_PHASE;
  const testSecretValue = 'MY_SUPER_CONFIDENTIAL_SECRET_12345';
  const prevSecret = process.env.SESSION_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PHASE;
    process.env.SESSION_SECRET = 'short'; // invalid length
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    _resetValidationForTesting();

    try {
      validateServerEnvironment();
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(!err.message.includes(testSecretValue));
      assert.ok(!err.message.includes('short')); // does not leak invalid secret either
    }
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.NEXT_PHASE = prevPhase;
    if (prevSecret) process.env.SESSION_SECRET = prevSecret;
    _resetValidationForTesting();
  }
});
