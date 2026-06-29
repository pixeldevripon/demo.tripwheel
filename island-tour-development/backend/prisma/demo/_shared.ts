// ─────────────────────────────────────────────────────────────────────────────
// DEMO SEED — shared foundation
// ─────────────────────────────────────────────────────────────────────────────
// This is throwaway demo data. It is NOT part of the production seed
// (`prisma/seed.ts`) and is NOT run by `build:prod`. Delete the `prisma/demo/`
// folder + the `prisma:seed:demo` script to remove it entirely.
//
// Everything here is idempotent and tagged with demo markers so `--clean` can
// remove exactly the demo rows without touching the real seed
// (admin user, categories, destinations, hubs, attribute dictionary).
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaPg } from '@prisma/adapter-pg';
import { Currency, Locale, Prisma, PrismaClient, TierKey } from '@prisma/client';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

// ── Demo markers (used for idempotency + clean) ─────────────────────────────────
export const DEMO_EMAIL_DOMAIN = 'demo.islandtours.test';
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'DemoPass123!';
/** Stamped on every demo Tour.reference so clean() can target them. */
export const DEMO_TOUR_REF = 'DEMO-SEED';
/** Stamped on demo NotificationSubscription/Webhook urls. */
export const DEMO_WEBHOOK_HOST = 'demo-webhooks.islandtours.test';

// ── Locales ─────────────────────────────────────────────────────────────────────
export const BASE_LOCALE: Locale = Locale.en;
export const ALL_LOCALES: Locale[] = [
  Locale.en,
  Locale.nl,
  Locale.de,
  Locale.fr,
  Locale.es,
  Locale.pt,
  Locale.zh,
];
export const NON_EN_LOCALES: Locale[] = ALL_LOCALES.filter((l) => l !== Locale.en);

/**
 * Produce a machine-translation stub for a non-English locale. Real English
 * content lives in the base row; other locales get a clearly-flagged stub so
 * locale switching exercises the fallback + isMachineTranslated paths.
 */
export function stub(locale: Locale, base: string): string {
  if (!base) return base;
  return `[${locale.toUpperCase()}] ${base}`;
}

// ── Tier engine (mirrors src/tiers/tiers.service.ts TIER_MAP) ────────────────────
export const TIER_MAP: Record<TierKey, { rank: number; commission: number }> = {
  [TierKey.premium]: { rank: 1, commission: 30.0 },
  [TierKey.featured]: { rank: 2, commission: 27.5 },
  [TierKey.boosted]: { rank: 3, commission: 25.0 },
  [TierKey.organic]: { rank: 4, commission: 22.5 },
  [TierKey.standard]: { rank: 5, commission: 20.0 },
};

// ── Decimal / money helpers (mirror booking-pricing.util) ────────────────────────
export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export const money = (v: Prisma.Decimal.Value) =>
  new Prisma.Decimal(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

const DEFAULT_USD_TO_EUR = 0.92;
export function eurFxRate(currency: Currency): Prisma.Decimal {
  if (currency === Currency.EUR) return D(1);
  const raw = process.env.FX_USD_TO_EUR;
  const parsed = raw ? Number(raw) : NaN;
  return D(Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_EUR);
}

/** Round a raw average to 1 dp (mirror review-display.util roundRating). */
export function roundRating(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}

// ── Date / time helpers ──────────────────────────────────────────────────────────
/** Today at 00:00 UTC — stable base for relative date math. */
export function today(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}
/** A @db.Date value N days from today (00:00 UTC). */
export function dayOffset(days: number): Date {
  const base = today();
  return new Date(base.getTime() + days * 86_400_000);
}
/** Build a @db.Time(0) value from 'HH:MM' (date part is ignored by Postgres TIME). */
export function timeOf(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
}
/** Combine a @db.Date and 'HH:MM' into a full local-ish instant (for booking start). */
export function dateAt(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m, 0),
  );
}
/** 0=Monday … 6=Sunday (tour-local), matching AvailabilitySchedule.weekday. */
export function isoWeekday(date: Date): number {
  const js = date.getUTCDay(); // 0=Sun … 6=Sat
  return js === 0 ? 6 : js - 1;
}

/** Booking display ref — mirror makeDisplayRef(id, localStart). */
export function makeDisplayRef(id: string, year: number): string {
  return `IT-${year}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

// ── Deterministic PRNG (so re-runs after --clean reproduce the same shape) ───────
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick<T>(arr: readonly T[], r: number): T {
  return arr[Math.floor(r * arr.length) % arr.length];
}
export function intBetween(r: number, min: number, max: number): number {
  return min + Math.floor(r * (max - min + 1));
}

// ── Media URLs (remote stock; deterministic via Picsum seed) ─────────────────────
const SAMPLE_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';
export function img(seed: string, w = 1280, h = 854): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}
export function videoUrl(): string {
  return SAMPLE_VIDEO;
}

// ── Logging ──────────────────────────────────────────────────────────────────────
export function log(msg: string): void {
  console.log(`  ${msg}`);
}
export function section(title: string): void {
  console.log(`\n── ${title} ──────────────────────────────────────────`);
}
