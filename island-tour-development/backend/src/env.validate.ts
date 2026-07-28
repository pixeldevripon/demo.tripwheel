/** Reusable validator: a positive integer (minutes/hours tuning knobs). */
const positiveIntEnv = (v: string): string | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? null : 'must be a positive integer';
};

/** Reusable validator: a seeded admin password (ADMIN_ / SYSTEM_ADMIN_). */
const seededAdminPassword = (v: string): string | null => {
  if (
    v === 'yourPassword' ||
    v.startsWith('REPLACE_ME') ||
    v.includes('change-me')
  )
    return 'placeholder detected - set a strong password before running the seed';
  if (v.length < 12) return 'must be at least 12 characters';
  return null;
};

const REQUIRED: Record<string, (v: string) => string | null> = {
  DATABASE_URL: () => null,
  BETTER_AUTH_SECRET: (v) => {
    if (v.length < 32) return 'must be at least 32 characters';
    if (v.includes('change-me'))
      return 'placeholder detected - generate a real secret: openssl rand -base64 32';
    return null;
  },
  // Signs traveler session tokens (email + booking-reference login, full TYP,
  // cancellation request). REQUIRED and independent - no fallback to
  // BETTER_AUTH_SECRET - so the two token systems have separate keys and
  // rotating one never invalidates the other.
  TRAVELER_SESSION_SECRET: (v) => {
    if (v.length < 32) return 'must be at least 32 characters';
    if (v.includes('change-me') || v.includes('CHANGE_ME'))
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
  // Shared secret sent as `x-revalidate-secret` to the public site's
  // `POST /api/revalidate` so backend-originated writes (nightly re-rank jobs)
  // bust its `'use cache'` tags. Must be ONE of the values in the frontend's
  // comma-separated REVALIDATE_SECRET list. Needs ISLAND_TOURS_URL to be set
  // too; when either is missing the PublicCacheService no-ops with a warning.
  REVALIDATE_SECRET: (v) => {
    if (v.length < 32) return 'must be at least 32 characters';
    if (v.includes('change-me') || v === 'secret')
      return 'placeholder detected - generate a real secret: openssl rand -base64 32';
    return null;
  },
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
  ADMIN_PASSWORD: seededAdminPassword,
  // Hidden internal-management admin (seed.ts seedSystemAdmin): same powers as
  // the visible admin but flagged isSystemAccount - excluded from every user
  // listing and immune to admin mutation. OPTIONAL: unset skips the seed. Held
  // by the internal management department, never handed to the client.
  SYSTEM_ADMIN_EMAIL: (v) =>
    /^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'must be an email address',
  SYSTEM_ADMIN_PASSWORD: seededAdminPassword,
  // Public origin for API links opened OUTSIDE the app (the confirmation email's
  // "Add to calendar" .ics link, clicked in a mail client with no session).
  // Defaults to BETTER_AUTH_URL, which is this API's own public origin; set only
  // when the API is fronted by a different hostname.
  PUBLIC_API_URL: (v) =>
    /^https?:\/\//.test(v) ? null : 'must be an absolute http(s) URL',
  // Transactional email (Resend) - env-configured only, no dashboard surface.
  // MAIL_FROM must be an address on a domain verified in the Resend account.
  RESEND_API_KEY: (v) =>
    v.startsWith('re_') ? null : 'must be a Resend API key (starts with re_)',
  MAIL_FROM: () => null,
  // AI translation (content entities + LD32 review comments). Provider-
  // agnostic: the key/model belong to whichever provider is selected (default
  // gemini). OPTIONAL: with no key the feature is inert - content and reviews
  // display in the language they were written in. The dashboard (Settings >
  // Integrations) values win over env; these are the local-dev / first-boot
  // fallback. Validated for shape only, so a typo is caught at boot rather
  // than as a 403 six locales deep.
  TRANSLATION_API_KEY: (v) =>
    v.length >= 20 ? null : 'must be a provider API key',
  TRANSLATION_MODEL: (v) =>
    v.trim().length > 0 ? null : 'must be a model name (e.g. gemini-3.6-flash)',
  // Provider selector (default 'gemini'). The allowed set lives in the
  // provider catalog (src/content-translation/providers/provider-catalog.ts);
  // 'custom' + TRANSLATION_BASE_URL accepts ANY OpenAI-compatible endpoint.
  TRANSLATION_PROVIDER_NAME: (v) =>
    [
      'gemini',
      'anthropic',
      'openai',
      'groq',
      'openrouter',
      'mistral',
      'deepseek',
      'custom',
    ].includes(v.toLowerCase())
      ? null
      : 'must be one of: gemini, anthropic, openai, groq, openrouter, mistral, deepseek, custom',
  TRANSLATION_BASE_URL: (v) =>
    /^https?:\/\/\S+$/.test(v)
      ? null
      : 'must be an http(s) URL (OpenAI-compatible endpoint)',
  // Payments & tracking (Phase 6). Stripe keys live in the DB, not here.
  FX_USD_TO_EUR: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0
      ? null
      : 'must be a positive number (e.g. 0.92)';
  },
  // FX provider selector (default 'static'). 'ecb' = keyless ECB reference rates
  // (Frankfurter). Charge-side FX (Stripe currency_conversion) is separate (payments
  // phase). See technical-doc/02-architecture/FX-AND-MULTI-CURRENCY.md.
  FX_PROVIDER: (v) =>
    ['static', 'ecb'].includes(v.toLowerCase())
      ? null
      : "must be 'static' or 'ecb'",
  // FX cache tuning (all optional - code defaults apply when unset). See
  // technical-doc/02-architecture/FX-AND-MULTI-CURRENCY.md.
  FX_RATE_TTL_MINUTES: positiveIntEnv, // rate freshness for booking quotes (default 120)
  FX_RATE_STALE_DISPLAY_HOURS: positiveIntEnv, // display fallback window (default 24)
  FX_RATE_REFRESH_MINUTES: positiveIntEnv, // scheduler cadence (default 30)
  META_PIXEL_ID: () => null,
  META_CAPI_TOKEN: () => null,
  META_CAPI_TEST_CODE: () => null,
  // Instagram feed auto-sync (Instagram API with Instagram Login) is configured
  // ENTIRELY from the DASHBOARD (Settings > Instagram): the admin pastes a
  // long-lived access token, stored encrypted on InstagramAccount with the
  // existing ENCRYPTION_KEY (crypto.util). It is DB-only by design - there is
  // deliberately no INSTAGRAM_ACCESS_TOKEN env var. The nightly refresh rotates
  // the token in place, also in the database.
};

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

  // ── Email check ─────────────────────────────────────────────────────────────
  // Warn but don't fail - the app boots without email, every send just fails
  // loudly until RESEND_API_KEY is provided.
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      '⚠  No RESEND_API_KEY found - email sending (verification, password reset, booking emails) will be disabled.',
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
