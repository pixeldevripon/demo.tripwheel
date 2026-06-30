const REQUIRED: Record<string, (v: string) => string | null> = {
  DATABASE_URL: () => null,
  BETTER_AUTH_SECRET: (v) => {
    if (v.length < 32) return 'must be at least 32 characters';
    if (v.includes('change-me'))
      return 'placeholder detected - generate a real secret: openssl rand -base64 32';
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
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: () => null,
  CLOUDINARY_API_KEY: () => null,
  CLOUDINARY_API_SECRET: () => null,
  // Encryption (settings & operator OAuth tokens)
  ENCRYPTION_KEY: (v) => {
    if (v.length < 32) return 'must be at least 32 hex characters';
    return null;
  },
};

const OPTIONAL: Record<string, (v: string) => string | null> = {
  ADMIN_PASSWORD: (v) => {
    if (
      v === 'yourPassword' ||
      v.startsWith('REPLACE_ME') ||
      v.includes('change-me')
    )
      return 'placeholder detected - set a strong password before running the seed';
    if (v.length < 12) return 'must be at least 12 characters';
    return null;
  },
  SMTP_HOST: () => null,
  SMTP_PORT: (v) =>
    isNaN(parseInt(v, 10)) ? 'must be a valid port number' : null,
  SMTP_USER: () => null,
  SMTP_PASS: () => null,
  MAIL_FROM: () => null,
  // Payments & tracking (Phase 6). Stripe keys live in the DB, not here.
  FX_USD_TO_EUR: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0
      ? null
      : 'must be a positive number (e.g. 0.92)';
  },
  META_PIXEL_ID: () => null,
  META_CAPI_TOKEN: () => null,
  META_CAPI_TEST_CODE: () => null,
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
  // All core SMTP vars must be set together - partial config will cause
  // silent send failures at runtime
  const smtpPresent = SMTP_GROUP.filter((k) => !!process.env[k]);
  const smtpMissing = SMTP_GROUP.filter((k) => !process.env[k]);

  if (smtpPresent.length > 0 && smtpMissing.length > 0) {
    errors.push(
      `Incomplete SMTP config - if any SMTP var is set, all are required. Missing: ${smtpMissing.join(', ')}`,
    );
  }

  if (smtpPresent.length === 0) {
    // Warn but don't fail - email features will be disabled
    console.warn(
      '⚠  No SMTP config found - email sending (verification, password reset) will be disabled.',
    );
  }

  // ── Redis / Upstash check ────────────────────────────────────────────────────
  const upstashUrl = process.env.UPSTASH_REDIS_URL;
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;

  if (!upstashUrl && (!redisHost || !redisPort)) {
    errors.push(
      'Redis config missing - provide either UPSTASH_REDIS_URL or both REDIS_HOST and REDIS_PORT.',
    );
  } else if (upstashUrl && upstashUrl.startsWith('https://')) {
    errors.push(
      'UPSTASH_REDIS_URL must be a rediss:// URL for BullMQ, not a https:// REST URL.',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `\n\nEnvironment validation failed:\n  • ${errors.join('\n  • ')}\n`,
    );
  }
}
