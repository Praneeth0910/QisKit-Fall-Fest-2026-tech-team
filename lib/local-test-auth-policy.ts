export function isLoopbackHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const trimmed = host.trim().toLowerCase();

  // Handle bare or bracketed IPv6 loopback
  if (trimmed === '::1') return true;
  if (trimmed.startsWith('[')) {
    const closingBracket = trimmed.indexOf(']');
    if (closingBracket === -1) return false;
    const ip = trimmed.slice(1, closingBracket);
    return ip === '::1';
  }

  // Remove port for IPv4 and named hostnames
  const hostname = trimmed.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function isLocalhost(host: string | null | undefined): boolean {
  return isLoopbackHost(host);
}

export interface ExtraHostHeaders {
  xForwardedHost?: string | null;
  xForwardedFor?: string | null;
  vercelEnv?: string;
  isVercel?: string;
  awsLambda?: string;
  env?: string;
}

export function isProductionOrCloudEnvironment(opts?: {
  nodeEnv?: string;
  vercelEnv?: string;
  isVercel?: string;
  awsLambda?: string;
  env?: string;
}): boolean {
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV;
  const vercelEnv = opts?.vercelEnv ?? process.env.VERCEL_ENV;
  const isVercel = opts?.isVercel ?? process.env.VERCEL;
  const awsLambda = opts?.awsLambda ?? process.env.AWS_LAMBDA_FUNCTION_NAME;
  const env = opts?.env ?? process.env.ENV;

  if (nodeEnv === 'production') return true;
  if (vercelEnv === 'production' || vercelEnv === 'preview') return true;
  if (isVercel === '1' || isVercel === 'true') return true;
  if (Boolean(awsLambda)) return true;
  if (env === 'production') return true;
  return false;
}

export function isLocalTestAuthEnabled(
  host: string | null | undefined,
  nodeEnv = process.env.NODE_ENV,
  optIn = process.env.QFF_LOCAL_TEST_AUTH,
  extra?: ExtraHostHeaders
): boolean {
  // Never enable in production or deployed cloud environments under ANY condition
  if (
    isProductionOrCloudEnvironment({
      nodeEnv,
      vercelEnv: extra?.vercelEnv,
      isVercel: extra?.isVercel,
      awsLambda: extra?.awsLambda,
      env: extra?.env,
    })
  ) {
    return false;
  }

  // Must be strictly in development mode with explicit opt-in
  if (nodeEnv !== 'development' || optIn !== 'true') {
    return false;
  }

  // If proxy headers are present, verify they also point strictly to loopback
  if (extra?.xForwardedHost && !isLoopbackHost(extra.xForwardedHost)) {
    return false;
  }
  if (extra?.xForwardedFor) {
    const firstClientIp = extra.xForwardedFor.split(',')[0].trim();
    if (!isLoopbackHost(firstClientIp)) {
      return false;
    }
  }

  return isLoopbackHost(host);
}
