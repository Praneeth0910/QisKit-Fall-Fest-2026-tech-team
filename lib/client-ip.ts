/**
 * Trusted Client IP Resolution Module
 *
 * Provides safe, spoof-resistant extraction of client IP addresses for rate limiting
 * and security auditing.
 *
 * Security Properties:
 * 1. Platform-Guaranteed IP Priority: Uses runtime socket `request.ip` when available.
 * 2. Vercel Edge Platform Protection: On Vercel (`process.env.VERCEL === '1'`), prioritizes
 *    `x-vercel-forwarded-for` and `x-real-ip`, which Vercel's edge network sanitizes and overwrites.
 * 3. Deliberate Fallback Policy: In untrusted or development environments without verified proxies,
 *    arbitrary client-supplied `X-Forwarded-For`, `X-Real-IP`, and `CF-Connecting-IP` headers
 *    are deliberately ignored, preventing attackers from forging fresh rate-limit identities.
 * 4. Rightmost Proxy Chain Resolution: When configured behind a trusted proxy, evaluates
 *    `X-Forwarded-For` from right to left (proxy-appended hop) rather than trusting client-prepended entries.
 * 5. Strict IP Validation: Validates IPv4 and IPv6 syntax, rejecting malformed or injected values.
 */

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const IPV6_REGEX =
  /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,7}:$|^:(?::[a-fA-F0-9]{1,4}){1,7}$|^(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,5}(?::[a-fA-F0-9]{1,4}){1,2}$|^(?:[a-fA-F0-9]{1,4}:){1,4}(?::[a-fA-F0-9]{1,4}){1,3}$|^(?:[a-fA-F0-9]{1,4}:){1,3}(?::[a-fA-F0-9]{1,4}){1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,2}(?::[a-fA-F0-9]{1,4}){1,5}$|^[a-fA-F0-9]{1,4}:(?::[a-fA-F0-9]{1,4}){1,6}$|^::(?:[a-fA-F0-9]{1,4}:){0,6}[a-fA-F0-9]{1,4}$|^::$/;

/**
 * Validates if the given string is a syntactically valid IPv4 or IPv6 address.
 */
export function isValidIp(ip: string | null | undefined): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed);
}

/**
 * Strips optional trailing port (e.g., "192.168.1.1:443") and validates IP format.
 */
export function sanitizeIp(ip: string | null | undefined): string | null {
  if (!ip || typeof ip !== 'string') return null;
  const trimmed = ip.trim();
  const withoutPort = trimmed.replace(/:\d+$/, '');
  if (isValidIp(withoutPort)) {
    return withoutPort;
  }
  if (isValidIp(trimmed)) {
    return trimmed;
  }
  return null;
}

export interface ClientIpOptions {
  /** Override Vercel environment detection (useful for unit testing) */
  isVercel?: boolean;
  /** Explicitly trusted header name (e.g., custom enterprise proxy) */
  trustedHeader?: string;
  /** Allow fallback to rightmost X-Forwarded-For if behind a verified reverse proxy */
  trustProxyHeaders?: boolean;
  /** Fallback IP when no trusted IP can be verified */
  fallbackIp?: string;
}

export interface RequestWithHeaders {
  headers: {
    get(name: string): string | null;
  };
  ip?: string;
}

/**
 * Extracts a verified client IP address for rate limiting and auditing.
 */
export function getTrustedClientIp(
  request: RequestWithHeaders,
  options?: ClientIpOptions
): string {
  const fallback = options?.fallbackIp ?? '127.0.0.1';

  // 1. NextRequest platform property (runtime socket IP provided by host runtime,
  // NOT derived from client-controlled HTTP headers)
  if (request.ip) {
    const sanitized = sanitizeIp(request.ip);
    if (sanitized) return sanitized;
  }

  // Determine whether running in a Vercel-managed deployment
  const isVercel =
    options?.isVercel ??
    Boolean(process.env.VERCEL === '1' || process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV);

  // 2. Deployed Vercel Edge Environment
  // Vercel's edge network guarantees that x-vercel-forwarded-for and x-real-ip
  // are stripped of client modifications and set to the verified connecting IP.
  if (isVercel) {
    const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
    if (vercelForwarded) {
      const parts = vercelForwarded.split(',').map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        const sanitized = sanitizeIp(part);
        if (sanitized) return sanitized;
      }
    }

    const vercelRealIp = request.headers.get('x-real-ip');
    if (vercelRealIp) {
      const sanitized = sanitizeIp(vercelRealIp);
      if (sanitized) return sanitized;
    }

    // In Vercel, if platform headers are missing, use deliberate fallback rather than untrusted headers
    return fallback;
  }

  // 3. Explicitly configured trusted proxy header (e.g. enterprise reverse proxy)
  const trustedHeader = options?.trustedHeader ?? process.env.TRUSTED_PROXY_HEADER;
  if (trustedHeader) {
    const headerVal = request.headers.get(trustedHeader);
    if (headerVal) {
      const sanitized = sanitizeIp(headerVal.split(',')[0].trim());
      if (sanitized) return sanitized;
    }
  }

  // 4. Configured trusted proxy headers (e.g., Cloudflare or custom reverse proxy)
  const trustProxyHeaders =
    options?.trustProxyHeaders ?? (process.env.TRUST_PROXY_HEADERS === 'true');

  if (trustProxyHeaders) {
    // Cloudflare connecting IP (only when explicitly configured to trust Cloudflare headers)
    const cfIp = request.headers.get('cf-connecting-ip');
    if (cfIp) {
      const sanitized = sanitizeIp(cfIp);
      if (sanitized) return sanitized;
    }

    // When trusting a reverse proxy chain, inspect from right to left (closest proxy appended IP)
    // NEVER the leftmost IP (which is untrusted and can be injected by the client)
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      const parts = forwardedFor.split(',').map((p) => p.trim()).filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        const sanitized = sanitizeIp(parts[i]);
        if (sanitized) return sanitized;
      }
    }
  }

  // 5. Deliberate Fallback Policy:
  // In untrusted environments (local development, test suites, unverified edge hosts),
  // arbitrary client-supplied headers (X-Forwarded-For, X-Real-IP, CF-Connecting-IP)
  // are deliberately NOT trusted to prevent attackers from creating fresh rate-limit identities.
  return fallback;
}
