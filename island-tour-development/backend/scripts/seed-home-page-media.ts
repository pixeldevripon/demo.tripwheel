/**
 * seed-home-page-media.ts - moves the homepage off bundled files and onto the
 * media gallery.
 *
 * Run:  pnpm home:media:seed            (from backend/)
 *       pnpm home:media:seed --dry-run  (list the work, touch nothing)
 *
 * WHY THIS EXISTS
 *   The homepage CMS ships with a fallback contract: every field is nullable and
 *   null renders the copy and imagery the SITE ships with. That makes the
 *   feature safe to release, but it also means a freshly built homepage editor
 *   shows a page full of empty fields describing images an admin cannot see,
 *   swap or reuse - they are files in the frontend bundle, not library assets.
 *   This script closes that gap once: every photo and video the homepage
 *   currently renders becomes a real gallery asset, and the homepage record is
 *   pointed at those assets, so what the editor shows IS what the site serves.
 *
 * TWO SOURCES, ON PURPOSE
 *   - Files under `frontend/public/` are uploaded here.
 *   - The "Top island experiences" reel already streams from Cloudinary (its
 *     URLs are hard-coded in `top-experiences.tsx`), in THIS account. Those are
 *     REGISTERED from the existing assets rather than re-uploaded: the bytes are
 *     already there, and a second copy would double ~100 MB of video storage for
 *     nothing.
 *
 * IDEMPOTENT: uploads use a deterministic public_id with overwrite+invalidate,
 * and every DB write is an upsert keyed on that id, so re-running replaces in
 * place and never duplicates a row or an asset.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { FaqPageType, Locale, PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { createHash } from 'crypto';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

import {
  CLOUDINARY_ROOT_FOLDER,
  CloudinaryService,
} from '../src/media-gallery/cloudinary.service';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

/** Where the public site keeps its bundled assets. */
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'frontend', 'public');

const HOME_ID = 'default';

/** A bundled file to publish. `slot` is what the homepage does with it. */
interface LocalAsset {
  /** Path under frontend/public. */
  file: string;
  /** Stable public_id leaf - the same file always lands on the same asset. */
  key: string;
  title: string;
  altText: string;
}

/**
 * Every image the homepage renders from the bundle. All of them are published,
 * not just the ones wired below: an admin swapping the hero wants the other
 * island shots in the picker, and they are the site's own art.
 */
const LOCAL_IMAGES: LocalAsset[] = [
  {
    file: 'images/kc-powerboat.jpg',
    key: 'hero-powerboat',
    title: 'Homepage hero - powerboat',
    altText: 'A powerboat cutting across clear Caribbean water',
  },
  {
    file: 'images/home-page/hero-bg.jpg',
    key: 'hero-bg',
    title: 'Homepage hero - alternative',
    altText: 'Caribbean coastline from the water',
  },
  {
    file: 'images/home-page/categories/buggy-tours.jpg',
    key: 'cta-buggy-tours',
    title: 'CTA card - buggy tours',
    altText: 'A buggy on a coastal dirt track',
  },
  {
    file: 'images/home-page/categories/snorkel-trips.jpg',
    key: 'cta-snorkel-trips',
    title: 'CTA card - snorkel trips',
    altText: 'A snorkeller over a reef',
  },
  {
    file: 'images/home-page/categories/catamaran-trips.jpg',
    key: 'cta-catamaran-trips',
    title: 'CTA card - catamaran trips',
    altText: 'A catamaran anchored in a bay',
  },
  {
    file: 'images/home-page/islands/curacao.jpg',
    key: 'island-curacao',
    title: 'Island - Curaçao',
    altText: 'The waterfront houses of Willemstad, Curaçao',
  },
  {
    file: 'images/home-page/islands/aruba.jpg',
    key: 'island-aruba',
    title: 'Island - Aruba',
    altText: 'A beach on Aruba',
  },
  {
    file: 'images/home-page/islands/sint-maarten.jpg',
    key: 'island-sint-maarten',
    title: 'Island - Sint Maarten',
    altText: 'The coastline of Sint Maarten',
  },
  {
    file: 'images/home-page/islands/saint-lucia.jpg',
    key: 'island-saint-lucia',
    title: 'Island - Saint Lucia',
    altText: 'The Pitons of Saint Lucia',
  },
  {
    file: 'images/home-page/faq/host-avatar.png',
    key: 'faq-host-avatar',
    title: 'FAQ - host avatar',
    altText: 'A local host',
  },
];

/**
 * The reel's assets, already in this Cloudinary account - the public_ids come
 * from the hard-coded URLs in `frontend/components/frontend/home/
 * top-experiences.tsx`. Registered, never re-uploaded.
 */
interface RemoteAsset {
  publicId: string;
  resourceType: 'image' | 'video';
  title: string;
  altText: string;
}

const REMOTE_ASSETS: RemoteAsset[] = [
  {
    publicId: 'sunset-cruise_sciih4',
    resourceType: 'image',
    title: 'Experience - sunset cruise',
    altText: 'A catamaran at sunset',
  },
  {
    publicId: 'catamaran-trip_s5njba',
    resourceType: 'image',
    title: 'Experience - catamaran trip',
    altText: 'A catamaran under sail',
  },
  {
    publicId: 'buggy-tour_iwaavw',
    resourceType: 'image',
    title: 'Experience - buggy tour',
    altText: 'A buggy on a coastal track',
  },
  {
    publicId: 'sunset-cruise_qojtp4',
    resourceType: 'video',
    title: 'Experience video - sunset cruise',
    altText: 'Sunset cruise reel',
  },
  {
    publicId: 'catamaran-trip_zohlkt',
    resourceType: 'video',
    title: 'Experience video - catamaran trip',
    altText: 'Catamaran trip reel',
  },
  {
    publicId: 'buggy-tour_xy8ctp',
    resourceType: 'video',
    title: 'Experience video - buggy tour',
    altText: 'Buggy tour reel',
  },
];

/**
 * Which reel asset belongs to which featured category, by the category's name.
 * Only these three have real footage; every other card keeps its photo.
 */
const EXPERIENCE_MEDIA: Record<string, { poster: string; video: string }> = {
  'Sunset Cruises': {
    poster: 'sunset-cruise_sciih4',
    video: 'sunset-cruise_qojtp4',
  },
  'Boat Tours & Cruises': {
    poster: 'catamaran-trip_s5njba',
    video: 'catamaran-trip_zohlkt',
  },
  'Off-Road Tours': {
    poster: 'buggy-tour_iwaavw',
    video: 'buggy-tour_xy8ctp',
  },
};

/**
 * The fanned CTA deck: one island per card, in fan order (left, middle, front).
 * Each card shows that island's name - translated, because it comes from the
 * destination record - and opens its page. An editorial choice, changeable in
 * the dashboard in two clicks.
 */
const CTA_DECK: { assetKey: string; destinationSlug: string }[] = [
  { assetKey: 'island-curacao', destinationSlug: 'curacao' },
  { assetKey: 'island-aruba', destinationSlug: 'aruba' },
  { assetKey: 'island-sint-maarten', destinationSlug: 'sint-maarten' },
];

/** The bundled hero, now a library asset. */
const HERO_ASSET_KEY = 'hero-powerboat';

/**
 * A starting search-engine listing for the homepage, written ONLY when the
 * field is still empty - an admin's own words are never overwritten.
 *
 * Without this the front door inherits the site-wide defaults from Settings,
 * which on a fresh install are whatever was typed there last. A homepage with
 * no listing of its own is the one page where that matters most.
 */
const SEO_FALLBACK = {
  metaTitle: 'Caribbean Tours & Activities, Chosen by Locals',
  metaDescription:
    'Book boat trips, snorkelling and island tours across Curaçao, Aruba and Sint Maarten.',
};

interface PublishedAsset {
  url: string;
  publicId: string;
}

/** The i18n dictionaries the public site ships with, one per supported locale. */
const DICTIONARY_DIR = path.join(
  __dirname,
  '..',
  '..',
  'frontend',
  'lib',
  'i18n',
  'dictionaries',
);

const DICTIONARY_LOCALES: Locale[] = [
  Locale.en,
  Locale.nl,
  Locale.de,
  Locale.fr,
  Locale.es,
  Locale.pt,
  Locale.zh,
];

interface DictionaryFaq {
  q: string;
  a: string;
}

/**
 * A stable id for a seeded FAQ group.
 *
 * `faqGroupId` is what ties one question's seven locale rows together, and the
 * service normally mints a random uuid per group. Seeding needs the id to be
 * derivable instead, so a re-run recognises what it already wrote rather than
 * creating a second set of five questions.
 */
function stableGroupId(seed: string): string {
  const h = createHash('sha1').update(seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `5${h.slice(13, 16)}`,
    `a${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

/**
 * Publish the homepage FAQ the site has been rendering from its bundled
 * dictionaries, in all 7 locales, as real FAQ rows.
 *
 * These questions have existed since before the CMS - they were simply
 * unreachable from the dashboard, so an admin could not edit, reorder or
 * translate them. Seeding them makes the block editable without changing a word
 * a visitor sees, and it does it for every locale at once because each
 * dictionary already carries its own translation.
 *
 * Deduplicated on the ENGLISH QUESTION TEXT, not on "are there any FAQs yet":
 * an admin may already have added one of these by hand (and had, on the first
 * run), so a wholesale skip would strand the other four while a blind insert
 * would duplicate the one. Matching the text adds exactly what is missing, and
 * a second run adds nothing.
 */
async function seedHomepageFaqs(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.faq.findMany({
    where: { pageType: FaqPageType.homepage, entityId: HOME_ID },
    select: { question: true, locale: true, faqGroupId: true },
  });

  // English question text -> the group it belongs to, so a question added by
  // hand is recognised and EXTENDED rather than duplicated or skipped.
  const groupByQuestion = new Map<string, string | null>();
  for (const row of existing) {
    if (row.locale === Locale.en) {
      groupByQuestion.set(row.question.trim().toLowerCase(), row.faqGroupId);
    }
  }
  const localesInGroup = new Map<string, Set<Locale>>();
  for (const row of existing) {
    const key = row.faqGroupId ?? '';
    const set = localesInGroup.get(key) ?? new Set<Locale>();
    set.add(row.locale);
    localesInGroup.set(key, set);
  }

  const byLocale = new Map<Locale, DictionaryFaq[]>();
  for (const locale of DICTIONARY_LOCALES) {
    const file = path.join(DICTIONARY_DIR, `${locale}.json`);
    if (!fs.existsSync(file)) continue;
    const dict = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      home?: { faq?: { items?: DictionaryFaq[] } };
    };
    const items = dict.home?.faq?.items;
    if (items?.length) byLocale.set(locale, items);
  }

  const base = byLocale.get(Locale.en);
  if (!base?.length) {
    console.warn('  FAQs: no English dictionary questions found - skipped.');
    return;
  }

  const rows: {
    pageType: FaqPageType;
    entityId: string;
    faqGroupId: string;
    locale: Locale;
    question: string;
    answer: string;
    displayOrder: number;
    isActive: boolean;
  }[] = [];

  let added = 0;
  let extended = 0;

  base.forEach((englishItem, index) => {
    const key = englishItem.q.trim().toLowerCase();
    const known = groupByQuestion.has(key);

    // Reuse the existing group when this question is already published, so the
    // translations attach to it instead of creating a rival copy.
    const faqGroupId = known
      ? (groupByQuestion.get(key) ?? stableGroupId(`homepage-faq-${index}`))
      : stableGroupId(`homepage-faq-${index}`);

    const present = localesInGroup.get(faqGroupId ?? '') ?? new Set<Locale>();
    let addedHere = 0;

    for (const [locale, items] of byLocale) {
      if (present.has(locale)) continue;
      // Locales are matched BY INDEX - each dictionary lists the same questions
      // in the same order. A locale that is short simply contributes fewer
      // rows; the group still exists via English.
      const item = items[index];
      if (!item?.q || !item?.a) continue;
      rows.push({
        pageType: FaqPageType.homepage,
        entityId: HOME_ID,
        faqGroupId,
        locale,
        question: item.q,
        answer: item.a,
        displayOrder: index,
        isActive: true,
      });
      addedHere += 1;
    }

    if (!addedHere) return;
    if (known) extended += 1;
    else added += 1;
  });

  if (!rows.length) {
    console.log('  FAQs: already published - nothing to add.');
    return;
  }

  await prisma.faq.createMany({ data: rows });
  console.log(
    `  FAQs: ${added} new question${added === 1 ? '' : 's'}` +
      (extended
        ? `, ${extended} existing one${extended === 1 ? '' : 's'} translated`
        : '') +
      ` (${rows.length} rows across ${byLocale.size} locales).`,
  );
}

async function main(): Promise<void> {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      'Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in backend/.env',
    );
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  // The URL policy (compress / upscale / pass-through) belongs to the app, not
  // to this script - instantiate the real service rather than restating it.
  const cloudinaryService = new CloudinaryService();

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) {
      throw new Error(
        'No ADMIN user found - gallery assets need an uploader (users.role = ADMIN).',
      );
    }

    console.log(
      `${DRY_RUN ? '[dry run] ' : ''}Publishing homepage media as ${admin.email}\n`,
    );

    const published = new Map<string, PublishedAsset>();

    // ── 1. Bundled files → Cloudinary ────────────────────────────────────────
    for (const asset of LOCAL_IMAGES) {
      const absolute = path.join(PUBLIC_DIR, asset.file);
      if (!fs.existsSync(absolute)) {
        console.warn(`  SKIP  ${asset.file} (not found)`);
        continue;
      }

      const publicId = `${CLOUDINARY_ROOT_FOLDER}/users/${admin.id}/homepage/${asset.key}`;

      if (DRY_RUN) {
        console.log(`  UPLOAD ${asset.file} -> ${publicId}`);
        published.set(asset.key, { url: '(dry run)', publicId });
        continue;
      }

      const result = await cloudinary.uploader.upload(absolute, {
        public_id: publicId,
        resource_type: 'image',
        overwrite: true,
        invalidate: true,
      });

      const url = cloudinaryService.getOptimizedUrl(
        result.public_id,
        result.resource_type,
        { bytes: result.bytes, width: result.width, format: result.format },
      );

      await upsertGalleryRow(prisma, admin.id, {
        url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        originalName: path.basename(asset.file),
        mimeType: `image/${result.format}`,
        bytes: result.bytes,
        format: result.format,
        width: result.width,
        height: result.height,
        title: asset.title,
        altText: asset.altText,
        fileName: asset.title,
      });

      published.set(asset.key, { url, publicId: result.public_id });
      console.log(`  UPLOADED ${asset.file}`);
    }

    // ── 2. Existing Cloudinary assets → gallery rows ─────────────────────────
    for (const asset of REMOTE_ASSETS) {
      if (DRY_RUN) {
        console.log(`  REGISTER ${asset.publicId} (${asset.resourceType})`);
        published.set(asset.publicId, {
          url: '(dry run)',
          publicId: asset.publicId,
        });
        continue;
      }

      let resource;
      try {
        resource = await cloudinary.api.resource(asset.publicId, {
          resource_type: asset.resourceType,
        });
      } catch {
        console.warn(
          `  SKIP  ${asset.publicId} (not in this Cloudinary account)`,
        );
        continue;
      }

      const url = cloudinaryService.getOptimizedUrl(
        resource.public_id,
        resource.resource_type,
        {
          bytes: resource.bytes,
          width: resource.width,
          format: resource.format,
        },
      );

      await upsertGalleryRow(prisma, admin.id, {
        url,
        publicId: resource.public_id,
        resourceType: resource.resource_type,
        originalName: `${asset.publicId}.${resource.format}`,
        mimeType: `${asset.resourceType}/${resource.format}`,
        bytes: resource.bytes,
        format: resource.format,
        width: resource.width,
        height: resource.height,
        title: asset.title,
        altText: asset.altText,
        fileName: asset.title,
      });

      published.set(asset.publicId, { url, publicId: resource.public_id });
      console.log(`  REGISTERED ${asset.publicId}`);
    }

    if (DRY_RUN) {
      console.log('\n[dry run] No database writes performed.');
      return;
    }

    // ── 3. Point the homepage at the assets ──────────────────────────────────
    const hero = published.get(HERO_ASSET_KEY);
    if (hero) {
      await prisma.homePage.upsert({
        where: { id: HOME_ID },
        create: { id: HOME_ID, heroImage: hero.url },
        update: { heroImage: hero.url },
      });
      console.log('\n  Hero image set.');
    }

    await seedHomepageFaqs(prisma);

    const english = await prisma.homePageTranslation.findUnique({
      where: { homeId_locale: { homeId: HOME_ID, locale: 'en' } },
      select: { metaTitle: true, metaDescription: true },
    });

    if (!english?.metaTitle && !english?.metaDescription) {
      await prisma.homePageTranslation.upsert({
        where: { homeId_locale: { homeId: HOME_ID, locale: 'en' } },
        create: { homeId: HOME_ID, locale: 'en', ...SEO_FALLBACK },
        update: SEO_FALLBACK,
      });
      console.log('  SEO title and description set (were empty).');
    }

    // The deck is a wholesale replace, exactly like the dashboard's save.
    const deck: {
      imageUrl: string;
      destinationId: string;
      isLink: boolean;
      displayOrder: number;
    }[] = [];

    for (const [index, card] of CTA_DECK.entries()) {
      const asset = published.get(card.assetKey);
      const destination = await prisma.destination.findUnique({
        where: { slug: card.destinationSlug },
        select: { id: true, name: true, isActive: true },
      });

      if (!asset || !destination) {
        console.warn(
          `  SKIP  CTA card ${index + 1} (missing ${!asset ? 'photo' : 'destination ' + card.destinationSlug})`,
        );
        continue;
      }

      deck.push({
        imageUrl: asset.url,
        destinationId: destination.id,
        isLink: true,
        displayOrder: deck.length,
      });
      console.log(`  CTA card ${deck.length}: ${destination.name}`);
    }

    if (deck.length) {
      await prisma.$transaction([
        prisma.homePageEditorialCard.deleteMany({ where: { homeId: HOME_ID } }),
        prisma.homePageEditorialCard.createMany({
          data: deck.map((card) => ({ ...card, homeId: HOME_ID })),
        }),
      ]);
    }

    // ── 4. Featured experiences: real footage, and no fake footage ───────────
    const featured = await prisma.featuredExperience.findMany({
      select: { id: true, entityId: true, videoUrl: true },
    });
    // Hubs as well as categories - `entityId` is polymorphic, and a row logged
    // as a bare uuid tells the operator nothing about what it changed.
    const entityIds = featured.map((f) => f.entityId);
    const [categories, hubs] = await Promise.all([
      prisma.category.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, name: true },
      }),
      prisma.hub.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, name: true },
      }),
    ]);
    const nameById = new Map(
      [...categories, ...hubs].map((e) => [e.id, e.name]),
    );

    for (const row of featured) {
      const media = EXPERIENCE_MEDIA[nameById.get(row.entityId) ?? ''];

      if (media) {
        const poster = published.get(media.poster);
        const video = published.get(media.video);
        if (!poster || !video) continue;

        await prisma.featuredExperience.update({
          where: { id: row.id },
          data: { posterUrl: poster.url, videoUrl: video.url },
        });
        console.log(
          `  Experience "${nameById.get(row.entityId)}": poster + video`,
        );
        continue;
      }

      // Demo rows point at a Google Chromecast sample clip. Leaving it is worse
      // than clearing it: the card falls back to its photo, which is real.
      if (row.videoUrl?.includes('commondatastorage.googleapis.com')) {
        await prisma.featuredExperience.update({
          where: { id: row.id },
          data: { videoUrl: null },
        });
        console.log(
          `  Experience "${nameById.get(row.entityId) ?? row.entityId}": cleared placeholder video`,
        );
      }
    }

    console.log('\nDone.');
  } finally {
    await prisma.$disconnect();
  }
}

/** Gallery rows are keyed on public_id, so a re-run updates rather than adds. */
async function upsertGalleryRow(
  prisma: PrismaClient,
  userId: string,
  data: {
    url: string;
    publicId: string;
    resourceType: string;
    originalName: string;
    mimeType: string;
    bytes?: number;
    format?: string;
    width?: number;
    height?: number;
    title: string;
    altText: string;
    fileName: string;
  },
) {
  const { publicId, ...rest } = data;
  await prisma.mediaGallery.upsert({
    where: { publicId },
    create: { ...rest, publicId, userId },
    update: {
      url: rest.url,
      bytes: rest.bytes,
      format: rest.format,
      width: rest.width,
      height: rest.height,
      title: rest.title,
      altText: rest.altText,
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
