import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLocalTestAuthEnabled,
  isLocalhost,
  isLoopbackHost,
  isProductionOrCloudEnvironment,
} from '../lib/local-test-auth-policy.ts';

test('enables only for development localhost requests with explicit opt-in', () => {
  assert.equal(isLocalTestAuthEnabled('localhost:3001', 'development', 'true'), true);
  assert.equal(isLocalTestAuthEnabled('127.0.0.1:3001', 'development', 'true'), true);
  assert.equal(isLocalTestAuthEnabled('[::1]:3000', 'development', 'true'), true);
  assert.equal(isLocalTestAuthEnabled('::1', 'development', 'true'), true);
});

test('rejects production and preview/non-local hosts', () => {
  assert.equal(isLocalTestAuthEnabled('localhost:3001', 'production', 'true'), false);
  assert.equal(isLocalTestAuthEnabled('preview.example.com', 'development', 'true'), false);
  assert.equal(isLocalTestAuthEnabled('localhost:3001', 'development', 'false'), false);
  assert.equal(isLocalTestAuthEnabled('localhost:3001', 'development', undefined), false);
  assert.equal(isLocalhost('localhost:3001'), true);
  assert.equal(isLocalhost('127.0.0.1:3001'), true);
  assert.equal(isLocalhost('[::1]:3000'), true);
  assert.equal(isLocalhost('::1'), true);
  assert.equal(isLocalhost('0.0.0.0:3001'), false);
  assert.equal(isLocalhost('192.168.1.10:3000'), false);
  assert.equal(isLocalhost('example.com'), false);
  assert.equal(isLoopbackHost('localhost'), true);
});

test('rejects local-test auth when cloud or production environment indicators are present', () => {
  // Production NODE_ENV
  assert.equal(isLocalTestAuthEnabled('localhost:3000', 'production', 'true'), false);

  // Vercel deployment indicators
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', { vercelEnv: 'production' }),
    false
  );
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', { vercelEnv: 'preview' }),
    false
  );
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', { isVercel: '1' }),
    false
  );

  // AWS Lambda indicator
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', {
      awsLambda: 'test-function',
    }),
    false
  );

  // General ENV=production
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', { env: 'production' }),
    false
  );

  assert.equal(
    isProductionOrCloudEnvironment({ nodeEnv: 'production' }),
    true
  );
  assert.equal(
    isProductionOrCloudEnvironment({ vercelEnv: 'production' }),
    true
  );
  assert.equal(
    isProductionOrCloudEnvironment({ nodeEnv: 'development' }),
    false
  );
});

test('rejects local-test auth if external proxy headers are present', () => {
  // Spoofed host header forwarded via proxy
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', {
      xForwardedHost: 'attacker.example.com',
    }),
    false
  );

  // Client IP forwarded from internet
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', {
      xForwardedFor: '203.0.113.195',
    }),
    false
  );

  // Loopback forwarded headers allowed in local proxy
  assert.equal(
    isLocalTestAuthEnabled('localhost:3000', 'development', 'true', {
      xForwardedHost: 'localhost:3000',
      xForwardedFor: '127.0.0.1',
    }),
    true
  );
});
