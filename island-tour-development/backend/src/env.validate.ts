const REQUIRED: Record<string, (v: string) => string | null> = {
  DATABASE_URL: () => null,
  BETTER_AUTH_SECRET: (v) => {
    if (v.length < 32) return 'must be at least 32 characters';
    if (v.includes('change-me'))
      return 'placeholder detected — generate a real secret: openssl rand -base64 32';
    return null;
  },
  BETTER_AUTH_URL: () => null,
  FRONTEND_URL: () => null,
  CORS_ORIGINS: (v) =>
    v.trim().length === 0
      ? 'must be a non-empty comma-separated list of origins'
      : null,
  NODE_ENV: (v) =>
    ['development', 'production', 'test'].includes(v)
      ? null
      : 'must be one of: development, production, test',
  PORT: (v) => (isNaN(parseInt(v, 10)) ? 'must be a valid port number' : null),
};

const OPTIONAL: Record<string, (v: string) => string | null> = {
  ADMIN_PASSWORD: (v) => {
    if (
      v === 'yourPassword' ||
      v.startsWith('REPLACE_ME') ||
      v.includes('change-me')
    )
      return 'placeholder detected — set a strong password before running the seed';
    if (v.length < 12) return 'must be at least 12 characters';
    return null;
  },
  SMTP_HOST: () => null,
  SMTP_PORT: (v) =>
    isNaN(parseInt(v, 10)) ? 'must be a valid port number' : null,
  SMTP_USER: () => null,
  SMTP_PASS: () => null,
  MAIL_FROM: () => null,
};

// SMTP vars that must all be present together or all absent
const SMTP_GROUP = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const;

export function validateEnv(): void {
  const errors: string[] = [];

  for (const [key, validate] of Object.entries(REQUIRED)) {
    const value = process.env[key];
    if (!value) {
      errors.push(`${key} is missing`);
    } else {
      const msg = validate(value);
      if (msg) errors.push(`${key}: ${msg}`);
    }
  }

  for (const [key, validate] of Object.entries(OPTIONAL)) {
    const value = process.env[key];
    if (value) {
      const msg = validate(value);
      if (msg) errors.push(`${key}: ${msg}`);
    }
  }

  // ── SMTP group check ────────────────────────────────────────────────────────
  // All core SMTP vars must be set together — partial config will cause
  // silent send failures at runtime
  const smtpPresent = SMTP_GROUP.filter((k) => !!process.env[k]);
  const smtpMissing = SMTP_GROUP.filter((k) => !process.env[k]);

  if (smtpPresent.length > 0 && smtpMissing.length > 0) {
    errors.push(
      `Incomplete SMTP config — if any SMTP var is set, all are required. Missing: ${smtpMissing.join(', ')}`,
    );
  }

  if (smtpPresent.length === 0) {
    // Warn but don't fail — email features will be disabled
    console.warn(
      '⚠  No SMTP config found — email sending (verification, password reset) will be disabled.',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `\n\nEnvironment validation failed:\n  • ${errors.join('\n  • ')}\n`,
    );
  }
}
