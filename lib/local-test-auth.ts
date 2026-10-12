import { headers } from 'next/headers.js';
import { isLocalTestAuthEnabled } from './local-test-auth-policy.ts';
export { isLocalTestAuthEnabled } from './local-test-auth-policy.ts';

export const LOCAL_TEST_EMAIL = 'local-qiskit-tester@localhost.invalid';
export const LOCAL_TEST_FULL_NAME = 'Local Qiskit Test User';

export interface LocalTestSession {
  email: string;
  fullName: string;
  role: 'tester';
  isAdmin: false;
}

export function getLocalTestSession(): LocalTestSession {
  return {
    email: LOCAL_TEST_EMAIL,
    fullName: LOCAL_TEST_FULL_NAME,
    role: 'tester',
    isAdmin: false,
  };
}

export async function isLocalTestAuthRequest(): Promise<boolean> {
  const requestHeaders = await headers();
  return isLocalTestAuthEnabled(
    requestHeaders.get('host'),
    process.env.NODE_ENV,
    process.env.QFF_LOCAL_TEST_AUTH,
    {
      xForwardedHost: requestHeaders.get('x-forwarded-host'),
      xForwardedFor: requestHeaders.get('x-forwarded-for'),
    }
  );
}
