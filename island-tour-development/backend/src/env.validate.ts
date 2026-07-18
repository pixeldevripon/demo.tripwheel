/** Reusable validator: a positive integer (minutes/hours tuning knobs). */
const positiveIntEnv = (v: string): string | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? null : 'must be a positive integer';
};

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
  // Public traveller site origin - booking-email links (TYP, /bookings, the
  // cancel page) send travellers here. Supersedes FRONTEND_URL for email
  // links (FRONTEND_URL remains as a fallback). No trailing slash/junk: the
  // value is embedded verbatim into emailed links.
  ISLAND_TOURS_URL: (v) =>
    /^https?:\/\/\S+[^\s./]$/.test(v.trim())
      ? null
      : 'must be an http(s) URL with no trailing slash, dot, or whitespace',
  // Operator portal base URL (the separated dashboard app), INCLUDING the
  // /portal path - operator emails (invite set-password link) send users here,
  // NOT to FRONTEND_URL (the public traveller site). No trailing slash/junk:
  // the value is embedded verbatim into emailed links.
  PORTAL_URL: (v) =>
    /^https?:\/\/\S+[^\s./]$/.test(v.trim())
      ? null
      : 'must be an http(s) URL with no trailing slash, dot, or whitespace',
  // Shared secret the trusted SSR/build server sends as `x-internal-api-key` to
  // bypass the per-IP throttle (see AuthModule). Must match the frontend's
  // server-only INTERNAL_API_SECRET. Server-only - never expose as NEXT_PUBLIC_.
  INTERNAL_API_SECRET: (v) => {
    // 32 chars to match BETTER_AUTH_SECRET's policy - this is the sole factor
    // gating the throttle bypass, so it must be as strong as the auth secret.
    if (v.length < 32) return 'must be at least 32 characters';
    if (v.includes('change-me') || v === 'secret')
      return 'placeholder detected - generate a real secret: openssl rand -base64 32';
    return null;
  },
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
  // Public origin for API links opened OUTSIDE the app (the confirmation email's
  // "Add to calendar" .ics link, clicked in a mail client with no session).
  // Defaults to BETTER_AUTH_URL, which is this API's own public origin; set only
  // when the API is fronted by a different hostname.
  PUBLIC_API_URL: (v) =>
    /^https?:\/\//.test(v) ? null : 'must be an absolute http(s) URL',
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
  // FX cache tuning (all optional - code defaults apply when unset). See
  // technical-doc/02-architecture/FX-AND-MULTI-CURRENCY.md.
  FX_RATE_TTL_MINUTES: positiveIntEnv, // rate freshness for booking quotes (default 120)
  FX_RATE_STALE_DISPLAY_HOURS: positiveIntEnv, // display fallback window (default 24)
  FX_RATE_REFRESH_MINUTES: positiveIntEnv, // scheduler cadence (default 30)
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

  // ── Trusted-origin bypass check ──────────────────────────────────────────────
  // Without the shared secret, the SSR/build server is throttled as an anonymous
  // client and a production `next build` can 429 mid-prerender.
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.INTERNAL_API_SECRET
  ) {
    // Hard-fail in production: without it the SSR guard's per-navigation fan-out
    // is throttled as an anonymous client, 429s mid-render, and bounces logged-in
    // users to /portal - a silent, hard-to-diagnose degradation. Fail loud at boot.
    errors.push(
      'INTERNAL_API_SECRET is required in production (must match the frontend value) so trusted first-party SSR/build requests bypass the per-IP throttle.',
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
