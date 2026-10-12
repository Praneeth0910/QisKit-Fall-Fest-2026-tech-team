import test from 'node:test';
import assert from 'node:assert/strict';
import { getTrustedClientIp, isValidIp, sanitizeIp } from '../lib/client-ip.ts';

function createMockRequest(headers = {}, ip = undefined) {
  const map = new Map();
  for (const [k, v] of Object.entries(headers)) {
    map.set(k.toLowerCase(), v);
  }
  return {
    headers: {
      get(name) {
        return map.get(name.toLowerCase()) ?? null;
      },
    },
    ip,
  };
}

test('client-ip: validates IPv4 and IPv6 formats correctly', () => {
  assert.equal(isValidIp('192.168.1.1'), true);
  assert.equal(isValidIp('10.0.0.1'), true);
  assert.equal(isValidIp('127.0.0.1'), true);
  assert.equal(isValidIp('::1'), true);
  assert.equal(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);

  // Invalid / injected strings
  assert.equal(isValidIp('999.999.999.999'), false);
  assert.equal(isValidIp('192.168.1'), false);
  assert.equal(isValidIp('192.168.1.1.1'), false);
  assert.equal(isValidIp('<script>alert(1)</script>'), false);
  assert.equal(isValidIp('unknown'), false);
  assert.equal(isValidIp(''), false);
  assert.equal(isValidIp(null), false);
  assert.equal(isValidIp(undefined), false);
});

test('client-ip: sanitizes IPs and strips optional port', () => {
  assert.equal(sanitizeIp('192.168.1.1:8080'), '192.168.1.1');
  assert.equal(sanitizeIp('  10.0.0.5  '), '10.0.0.5');
  assert.equal(sanitizeIp('invalid-ip:443'), null);
});

test('client-ip: in untrusted environment, forged headers cannot produce fresh rate-limit identities', () => {
  // Attacker sends arbitrary X-Forwarded-For, X-Real-IP, and CF-Connecting-IP on successive calls
  const req1 = createMockRequest({
    'x-forwarded-for': '203.0.113.1',
    'x-real-ip': '203.0.113.2',
    'cf-connecting-ip': '203.0.113.3',
  });

  const req2 = createMockRequest({
    'x-forwarded-for': '198.51.100.10',
    'x-real-ip': '198.51.100.20',
    'cf-connecting-ip': '198.51.100.30',
  });

  const req3 = createMockRequest({
    'x-forwarded-for': '10.0.0.99',
  });

  const ip1 = getTrustedClientIp(req1, { isVercel: false });
  const ip2 = getTrustedClientIp(req2, { isVercel: false });
  const ip3 = getTrustedClientIp(req3, { isVercel: false });

  // In untrusted environment without verified proxy, deliberate fallback policy applies
  assert.equal(ip1, '127.0.0.1');
  assert.equal(ip2, '127.0.0.1');
  assert.equal(ip3, '127.0.0.1');

  // All three requests map to identical rate-limit identity, defeating bypass attempts
  assert.equal(ip1, ip2);
  assert.equal(ip2, ip3);
});

test('client-ip: platform socket property (request.ip) is prioritized over all headers', () => {
  const req = createMockRequest(
    {
      'x-forwarded-for': 'forged-ip-1',
      'x-real-ip': 'forged-ip-2',
      'cf-connecting-ip': 'forged-ip-3',
    },
    '198.51.100.77'
  );

  const resolvedIp = getTrustedClientIp(req, { isVercel: false });
  assert.equal(resolvedIp, '198.51.100.77');
});

test('client-ip: on Vercel, x-vercel-forwarded-for is prioritized over forged client headers', () => {
  const req = createMockRequest({
    'x-vercel-forwarded-for': '203.0.113.50',
    'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    'x-real-ip': '9.10.11.12',
    'cf-connecting-ip': '13.14.15.16',
  });

  const resolvedIp = getTrustedClientIp(req, { isVercel: true });
  assert.equal(resolvedIp, '203.0.113.50');
});

test('client-ip: on Vercel, x-real-ip is used if x-vercel-forwarded-for is absent', () => {
  const req = createMockRequest({
    'x-real-ip': '203.0.113.60',
    'x-forwarded-for': '1.2.3.4',
  });

  const resolvedIp = getTrustedClientIp(req, { isVercel: true });
  assert.equal(resolvedIp, '203.0.113.60');
});

test('client-ip: on Vercel, absent headers fall back to deliberate fallback', () => {
  const req = createMockRequest({});
  const resolvedIp = getTrustedClientIp(req, { isVercel: true });
  assert.equal(resolvedIp, '127.0.0.1');
});

test('client-ip: when trusting reverse proxy chain, inspects rightmost IP (not client-supplied leftmost)', () => {
  // Client attempts to inject 1.2.3.4 as the leftmost entry, while reverse proxy appended 198.51.100.99
  const req = createMockRequest({
    'x-forwarded-for': '1.2.3.4, 198.51.100.99',
  });

  const resolvedIp = getTrustedClientIp(req, { isVercel: false, trustProxyHeaders: true });
  assert.equal(resolvedIp, '198.51.100.99');
});

test('client-ip: malformed header values are safely rejected and fall back', () => {
  const req = createMockRequest({
    'x-vercel-forwarded-for': '<script>bad_payload</script>',
  });

  const resolvedIp = getTrustedClientIp(req, { isVercel: true });
  assert.equal(resolvedIp, '127.0.0.1');
});

test('client-ip: rate-limit bucket simulation confirms forged headers cannot evade window', () => {
  // Sliding window counter simulation
  const rateLimitBuckets = new Map();
  const LIMIT = 5;

  function simulateRateLimit(req, options) {
    const key = getTrustedClientIp(req, options);
    const count = rateLimitBuckets.get(key) ?? 0;
    if (count >= LIMIT) {
      return { success: false, status: 429, key };
    }
    rateLimitBuckets.set(key, count + 1);
    return { success: true, status: 200, key, remaining: LIMIT - (count + 1) };
  }

  // Same client issues 5 requests with differing forged headers in untrusted environment
  for (let i = 1; i <= 5; i++) {
    const req = createMockRequest({
      'x-forwarded-for': `203.0.113.${i}`,
      'x-real-ip': `203.0.113.${i + 10}`,
      'cf-connecting-ip': `203.0.113.${i + 20}`,
    });
    const res = simulateRateLimit(req, { isVercel: false });
    assert.equal(res.success, true);
    assert.equal(res.key, '127.0.0.1');
  }

  // 6th request with yet another forged IP MUST be rejected with 429
  const req6 = createMockRequest({
    'x-forwarded-for': '203.0.113.99',
    'x-real-ip': '203.0.113.199',
  });
  const res6 = simulateRateLimit(req6, { isVercel: false });
  assert.equal(res6.success, false);
  assert.equal(res6.status, 429);
  assert.equal(res6.key, '127.0.0.1');
});
