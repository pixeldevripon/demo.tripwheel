/**
 * Build BullMQ Redis connection options (shared by every queue + worker).
 *
 * ## Upstash Redis (recommended for production)
 * Upstash provides a `rediss://` URL (note the double 's' - TLS).
 * Set UPSTASH_REDIS_URL in your .env:
 *   UPSTASH_REDIS_URL=rediss://default:<token>@<host>.upstash.io:6379
 *
 * When UPSTASH_REDIS_URL is present we parse host/port/password from it
 * and enable `tls: {}` (required by Upstash).
 *
 * ## Local Redis (development fallback)
 * Without UPSTASH_REDIS_URL, falls back to:
 *   REDIS_HOST=localhost  REDIS_PORT=6379  (no TLS)
 */
export function buildRedisConnection() {
  const upstashUrl = process.env.UPSTASH_REDIS_URL;

  if (upstashUrl) {
    // Parse  rediss://default:<password>@<host>:<port>
    const url = new URL(upstashUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      // Upstash requires TLS - the protocol is rediss://
      tls: url.protocol === 'rediss:' ? {} : undefined,
      /**
       * BullMQ worker requirements:
       * 1. maxRetriesPerRequest must be null to prevent worker crashes on connection drops.
       * 2. enableOfflineQueue should be true (default) to queue commands while reconnecting.
       */
      maxRetriesPerRequest: null,
      connectTimeout: 10000,
    };
  }

  // Local / self-hosted Redis (e.g. the `redis` service in docker-compose).
  // REDIS_PASSWORD is optional: unset for a password-less dev Redis, set when
  // the container runs with `--requirepass` (recommended in production).
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}
