'use client';

/**
 * Shared Client-Side Session Fetcher with In-Flight Deduplication and TTL Caching
 *
 * Prevents multiple components (AuthGate, LearningSidebar, page) on the same page
 * from firing separate simultaneous HTTP requests to /api/auth/session.
 */

interface SessionResponse {
  authenticated: boolean;
  session: {
    email: string;
    fullName: string;
    role: string;
    isAdmin: boolean;
  } | null;
}

let cachedSessionResponse: SessionResponse | null = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 25000; // 25 seconds memory cache

let inFlightPromise: Promise<SessionResponse> | null = null;

export async function getClientSession(forceRefresh = false): Promise<SessionResponse> {
  const now = Date.now();

  if (!forceRefresh && cachedSessionResponse && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return cachedSessionResponse;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const res = await fetch('/api/auth/session');
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { authenticated: false, session: null };
      }
      const data: SessionResponse = await res.json();
      cachedSessionResponse = data;
      lastFetchTimestamp = Date.now();
      return data;
    } catch (err) {
      console.warn('[Session Client] Fetch error:', err);
      return { authenticated: false, session: null };
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

export function invalidateClientSessionCache() {
  cachedSessionResponse = null;
  lastFetchTimestamp = 0;
  inFlightPromise = null;
}
