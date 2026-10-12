export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { validateServerEnvironment } = await import('./lib/env-validator.ts');
      validateServerEnvironment();
    } catch (err) {
      console.warn('[Instrumentation] Environment startup validation warning:', err);
    }
  }
}
