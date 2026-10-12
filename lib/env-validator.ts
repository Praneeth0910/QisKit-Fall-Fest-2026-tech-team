import { isProductionOrCloudEnvironment } from './local-test-auth-policy.ts';

let hasValidated = false;

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates mandatory environment variables according to their actual usage.
 * - Enforces production secrets at server runtime without breaking static builds.
 * - Never prints or exposes secret values in error messages.
 * - Issues clear warnings for development fallback modes.
 * - Guarantees that local-test authentication is never permitted in production.
 */
export function validateServerEnvironment(): EnvValidationResult {
  if (hasValidated) {
    return { valid: true, errors: [], warnings: [] };
  }
  hasValidated = true;

  const errors: string[] = [];
  const warnings: string[] = [];

  const isProd = isProductionOrCloudEnvironment();
  const isBuild =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.npm_lifecycle_event === 'build';

  // 1. Guard against accidental local-test auth opt-in in production
  if (isProd && process.env.QFF_LOCAL_TEST_AUTH === 'true') {
    warnings.push(
      'QFF_LOCAL_TEST_AUTH=true was specified in a production or cloud environment. Local-test authentication is permanently disabled in production and will be ignored.'
    );
  }

  // 2. Validate Supabase URL format if set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        errors.push('NEXT_PUBLIC_SUPABASE_URL must use http: or https: protocol.');
      }
    } catch {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.');
    }
  }

  // 3. Validate runtime secrets in production runtime (skipped during static builds)
  if (isProd && !isBuild) {
    // A. SESSION_SECRET (or AUTH_SECRET) - mandatory 32+ characters
    const sessionSecret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
    if (!sessionSecret) {
      errors.push(
        'SESSION_SECRET (or AUTH_SECRET) must be set in production for session cryptographic signing.'
      );
    } else if (sessionSecret.length < 32) {
      errors.push(
        `SESSION_SECRET must be at least 32 characters in production (currently ${sessionSecret.length} characters).`
      );
    }

    // B. SUPABASE_SERVICE_ROLE_KEY - mandatory in production for admin client
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey?.trim()) {
      errors.push(
        'SUPABASE_SERVICE_ROLE_KEY must be configured in production for authoritative database operations.'
      );
    }

    // C. QISKIT_JUDGE_SECRET - mandatory if QISKIT_JUDGE_URL is configured
    const judgeUrl = process.env.QISKIT_JUDGE_URL;
    const judgeSecret = process.env.QISKIT_JUDGE_SECRET;
    if (judgeUrl && !judgeSecret?.trim()) {
      errors.push(
        'QISKIT_JUDGE_SECRET must be configured in production when QISKIT_JUDGE_URL is set.'
      );
    }
  } else if (!isProd) {
    // Non-production diagnostic guidance
    const sessionSecret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
    if (!sessionSecret) {
      warnings.push(
        'SESSION_SECRET is not configured; using development fallback key. Set SESSION_SECRET before production deployment.'
      );
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      warnings.push(
        'SUPABASE_SERVICE_ROLE_KEY is not configured; administrative server-side database operations will throw until set.'
      );
    }
  }

  for (const warning of warnings) {
    console.warn(`[EnvValidator] ${warning}`);
  }

  if (errors.length > 0) {
    const errorSummary = `[EnvValidator] Startup environment validation failed:\n${errors.map((e) => `  • ${e}`).join('\n')}`;
    console.error(errorSummary);
    if (isProd && !isBuild) {
      throw new Error(errorSummary);
    }
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

/**
 * Resets the validation flag for testing purposes.
 */
export function _resetValidationForTesting(): void {
  hasValidated = false;
}
