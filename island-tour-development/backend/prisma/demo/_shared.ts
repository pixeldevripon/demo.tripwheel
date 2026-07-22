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

import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Currency,
  Locale,
  Prisma,
  PrismaClient,
  TierKey,
} from '@prisma/client';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

/**
 * Deterministic UUID for a demo row - the foundation of a re-runnable seed.
 *
 * ## Why this exists
 * Re-seeding used to require `--clean` first, which deletes the whole demo graph.
 * On a VPS that is unacceptable: a re-seed to pick up new demo content would take
 * every booking, payment and review with it, and any real data entangled with
 * them. The blocker was that rows with no natural key (bookings, payments,
 * departures, reviews) were created with `randomUUID()`, so a second run could
 * only ever duplicate them - there was no way to say "the same row again".
 *
 * Hashing a STABLE key into the id makes every such row addressable across runs,
 * which is what turns `.create` into `.upsert`. Same inputs -> same id -> update
 * in place. New inputs -> new id -> insert. Nothing is ever deleted.
 *
 * Produces a valid v5-shaped UUID (SHA-1, version and variant bits set), so it
 * satisfies Postgres `uuid` columns and Prisma's `@db.Uuid` typing.
 *
 * @param namespace Entity family, e.g. `'booking'`. Keeps keyspaces apart so a
 *                  booking and a payment built from the same key never collide.
 * @param key       Stable identity WITHIN that family, e.g. `${tourSlug}:${i}`.
 *                  It must not contain anything random or time-based, or the
 *                  whole point is lost.
 */
export function demoId(namespace: string, key: string): string {
  const h = createHash('sha1')
    .update(`island-tours:demo:${namespace}:${key}`)
    .digest('hex');
  const v5 =
    h.slice(0, 8) +
    '-' +
    h.slice(8, 12) +
    '-5' + // version 5
    h.slice(13, 16) +
    '-' +
    // variant: one of 8, 9, a, b
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) +
    h.slice(17, 20) +
    '-' +
    h.slice(20, 32);
  return v5;
}

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
export const NON_EN_LOCALES: Locale[] = ALL_LOCALES.filter(
  (l) => l !== Locale.en,
);

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
  return new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
  );
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
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      h,
      m,
      0,
    ),
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

// ── Media URLs (curated topical stock) ───────────────────────────────────────────
const SAMPLE_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';
export function videoUrl(): string {
  return SAMPLE_VIDEO;
}

/**
 * Curated Unsplash photos, all verified live (2026-07), each topical to the
 * content it illustrates - a catamaran tour gets catamaran photos, Willemstad
 * gets the painted waterfront, not a random landscape. Same host + URL shape
 * as the prod seed's category heroes (whitelisted in frontend next.config).
 */
const PHOTO_IDS = {
  sailboat: 'photo-1500514966906-fe245eea9344',
  sailingHeel: 'photo-1508009603885-50cf7c579365',
  catamaranDeck: 'photo-1534854638093-bada1813ca19',
  boatReefAerial: 'photo-1544551763-46a013bb70d5',
  yachtSide: 'photo-1567899378494-47b22a2ae96a',
  yachtAerial: 'photo-1569263979104-865ab7cd8d13',
  yachtBow: 'photo-1605281317010-fe5ffe798166',
  turtleClose: 'photo-1544552866-d3ed42536cfd',
  turtleReef: 'photo-1518467166778-b88f373ffec7',
  turtleSwim: 'photo-1591025207163-942350e47db2',
  snorkeler: 'photo-1560275619-4662e36fa65c',
  coralReef: 'photo-1582967788606-a171c1080cb0',
  scubaDiver: 'photo-1571406252241-db0280bd36cd',
  diverDeep: 'photo-1583212292454-1fe6229603b7',
  beachClassic: 'photo-1507525428034-b723cf961d3e',
  beachPalms: 'photo-1506953823976-52e1fdc0149a',
  beachChairs: 'photo-1509233725247-49e657c54213',
  beachCove: 'photo-1519046904884-53103b34b206',
  beachHammock: 'photo-1473116763249-2faaef81ccda',
  openOcean: 'photo-1505228395891-9a51e7e86bf6',
  oceanWave: 'photo-1559827260-dc66d52bef19',
  sunsetSea: 'photo-1500530855697-b586d89ba3ee',
  sunsetBeach: 'photo-1495954484750-af469f2f9be5',
  sunsetJump: 'photo-1506197603052-3cc9c3a201bd',
  willemstad: 'photo-1580237072617-771c3ecc4a24',
  flamingo: 'photo-1497206365907-f5e630693df0',
  pitons: 'photo-1547025603-ef800f02690e',
  jeepTrail: 'photo-1533130061792-64b345e4a833',
  kayakYellow: 'photo-1463694775559-eea25626346b',
  kayakClear: 'photo-1545558014-8692077e9b5c',
  chefFlames: 'photo-1414235077428-338989a2e8c0',
  bbqGrill: 'photo-1529193591184-b1d58069ecdd',
  grilledFood: 'photo-1555939594-58d7cb561ad1',
  cocktails: 'photo-1551024709-8f23befc6f87',
  rumGlass: 'photo-1470337458703-46ad1756a187',
  dolphins: 'photo-1607153333879-c174d265f1d2',
  friendsBeach: 'photo-1520454974749-611b7248ffdb',
  travelers: 'photo-1473496169904-658ba7c44d8a',
  coupleFloat: 'photo-1476673160081-cf065607f449',
  aerialCoast: 'photo-1468413253725-0d5181091126',
  aerialAtoll: 'photo-1559128010-7c1ad6e1b6a5',
  aerialIsland: 'photo-1573843981267-be1999ff37cd',
  colonialStreet: 'photo-1555881400-74d7acaacd8b',
  hikingRidge: 'photo-1551632811-561732d1e306',
  watersports: 'photo-1530866495561-507c9faab2ed',
  tropicalForest: 'photo-1437846972679-9e6e537be46e',
  resortPool: 'photo-1540541338287-41700207dee6',
  lagoonPool: 'photo-1502933691298-84fc14542831',
  seaCliffs: 'photo-1502680390469-be75c86b636f',
  wildBird: 'photo-1564349683136-77e08dba1ef7',
  fruitMarket: 'photo-1488459716781-31db52582fe9',
  caveLight: 'photo-1499244571948-7ccddb3583f1',
  lighthouse: 'photo-1507400492013-162706c8c05e',
  parasail: 'photo-1530053969600-caed2596d242',
  fishCatch: 'photo-1524704796725-9fc3044a58b2',
} as const;

export type PhotoName = keyof typeof PHOTO_IDS;

/** One curated topical photo at the requested crop. */
export function photo(name: PhotoName, w = 1280, h = 854): string {
  return `https://images.unsplash.com/${PHOTO_IDS[name]}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
}

/**
 * Topical photo pools per tour theme - each pool has 5+ entries so a tour's
 * gallery (hero + 4) stays varied. Order matters: the first entry is the hero.
 */
export const PHOTO_THEMES = {
  catamaran: [
    'catamaranDeck',
    'sailboat',
    'sailingHeel',
    'boatReefAerial',
    'sunsetSea',
    'oceanWave',
  ],
  yacht: [
    'yachtSide',
    'yachtAerial',
    'yachtBow',
    'boatReefAerial',
    'sunsetSea',
    'cocktails',
  ],
  speedboat: [
    'watersports',
    'boatReefAerial',
    'openOcean',
    'aerialIsland',
    'beachClassic',
    'oceanWave',
  ],
  snorkel: [
    'snorkeler',
    'turtleClose',
    'coralReef',
    'boatReefAerial',
    'beachPalms',
    'turtleReef',
  ],
  dive: [
    'scubaDiver',
    'diverDeep',
    'coralReef',
    'turtleSwim',
    'oceanWave',
    'boatReefAerial',
  ],
  turtle: [
    'turtleClose',
    'turtleReef',
    'turtleSwim',
    'snorkeler',
    'beachPalms',
    'coralReef',
  ],
  sunset: [
    'sunsetSea',
    'sunsetBeach',
    'sunsetJump',
    'sailboat',
    'cocktails',
    'oceanWave',
  ],
  cityCulture: [
    'willemstad',
    'colonialStreet',
    'fruitMarket',
    'chefFlames',
    'beachCove',
    'grilledFood',
  ],
  foodMarket: [
    'fruitMarket',
    'chefFlames',
    'grilledFood',
    'colonialStreet',
    'cocktails',
    'rumGlass',
  ],
  tasting: [
    'rumGlass',
    'cocktails',
    'chefFlames',
    'grilledFood',
    'fruitMarket',
    'colonialStreet',
  ],
  caves: [
    'caveLight',
    'tropicalForest',
    'willemstad',
    'hikingRidge',
    'oceanWave',
    'seaCliffs',
  ],
  offroad: [
    'jeepTrail',
    'hikingRidge',
    'tropicalForest',
    'beachChairs',
    'sunsetBeach',
    'aerialIsland',
  ],
  hike: [
    'hikingRidge',
    'seaCliffs',
    'tropicalForest',
    'lagoonPool',
    'openOcean',
    'aerialCoast',
  ],
  kayak: [
    'kayakYellow',
    'kayakClear',
    'tropicalForest',
    'aerialCoast',
    'beachPalms',
    'lagoonPool',
  ],
  jetski: [
    'watersports',
    'openOcean',
    'aerialIsland',
    'beachClassic',
    'friendsBeach',
    'boatReefAerial',
  ],
  parasail: [
    'parasail',
    'watersports',
    'aerialCoast',
    'openOcean',
    'beachClassic',
    'aerialIsland',
  ],
  tubing: [
    'friendsBeach',
    'watersports',
    'beachClassic',
    'openOcean',
    'aerialIsland',
    'coupleFloat',
  ],
  fishing: [
    'fishCatch',
    'boatReefAerial',
    'oceanWave',
    'sunsetBeach',
    'sailingHeel',
    'openOcean',
  ],
  beach: [
    'beachClassic',
    'beachPalms',
    'beachChairs',
    'beachCove',
    'beachHammock',
    'sunsetBeach',
  ],
} as const satisfies Record<string, readonly PhotoName[]>;

export type PhotoTheme = keyof typeof PHOTO_THEMES;

/** The Nth photo of a theme pool (wraps), at the requested crop. */
export function themedPhoto(
  theme: PhotoTheme,
  index = 0,
  w = 1280,
  h = 854,
): string {
  const pool = PHOTO_THEMES[theme];
  return photo(pool[index % pool.length], w, h);
}

/** Slug keyword -> theme, checked in order (first match wins). */
const TOUR_THEME_RULES: [RegExp, PhotoTheme][] = [
  [/sunset|champagne/, 'sunset'],
  [/catamaran/, 'catamaran'],
  [/yacht/, 'yacht'],
  [/speedboat|powerboat/, 'speedboat'],
  [/turtle/, 'turtle'],
  [/snorkel/, 'snorkel'],
  [/dive|diving/, 'dive'],
  [/walking|old-town|sightseeing|culture/, 'cityCulture'],
  [/food|market/, 'foodMarket'],
  [/rum|chocolate|tasting/, 'tasting'],
  [/cave/, 'caves'],
  [/utv|jeep|buggy|off-road|safari/, 'offroad'],
  [/hike|natural-pool|cliff/, 'hike'],
  [/kayak|mangrove/, 'kayak'],
  [/jet-ski/, 'jetski'],
  [/parasail|flyboard/, 'parasail'],
  [/banana-boat|tube/, 'tubing'],
  [/fishing/, 'fishing'],
  [/boat|sail/, 'catamaran'],
];

/** Resolve a tour slug to its topical theme (beach as the neutral fallback). */
export function tourTheme(slug: string): PhotoTheme {
  for (const [re, theme] of TOUR_THEME_RULES) if (re.test(slug)) return theme;
  return 'beach';
}

// ── Logging ──────────────────────────────────────────────────────────────────────
export function log(msg: string): void {
  console.log(`  ${msg}`);
}
export function section(title: string): void {
  console.log(`\n── ${title} ──────────────────────────────────────────`);
}
