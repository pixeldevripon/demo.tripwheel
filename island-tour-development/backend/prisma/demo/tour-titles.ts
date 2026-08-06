// DEMO SEED - take the hub's own name back out of the tour titles.
//
//   pnpm prisma:seed:demo:tour-titles         apply
//   pnpm prisma:seed:demo:tour-titles:dry     print the diff, write nothing
//
// WHY THIS IS ITS OWN SCRIPT, and not just a blueprint edit:
// the full demo seed refreshes `tours.name` from the blueprint on a re-run, but
// it deliberately leaves the tour's CHILDREN alone (prisma/demo/tours.ts, the
// `existing` branch) so a re-seed never deletes rows an admin edited - and the
// title the public site actually renders is the CHILD one:
// `title: translations[0]?.title ?? t.name` (tours.service.ts). So a plain
// `pnpm prisma:seed:demo` would move the column nobody reads and leave every
// visible title untouched. This script closes exactly that gap.
//
// SCOPE - titles, and nothing else. A tour's title is spread over FIVE columns,
// and missing one shows: the breadcrumb kept saying "Klein Curaçao Private
// Speedboat Charter" above an H1 that already said "Charter privado en lancha
// rápida", because `breadcrumbLabel` is a separate override column.
//   tours.name                    the canonical/base title
//   tours.h1Override              the title as the page heading, when overridden
//   tours.breadcrumbLabel         the title as the last crumb, when overridden
//   tour_translations.title       the per-locale title, i.e. what renders
//   tour_translations.metaTitle   the same title again, in the <title> tag
// ...and the URL, which is renamed to match:
//   tours.slug                    klein-curacao-full-day-catamaran -> full-day-catamaran
//   slug_registry.slug            the resolver row, renamed in the SAME transaction
//                                 (critical rule #4) so the URL never resolves to nothing
//   slug_redirects                a 301 from the old slug to the new one
//
// It does NOT touch overview/description prose (a sentence about sailing to
// Klein Curaçao still needs to say so), bookings, availability, or anything else.
//
// A RENAME IS NOT FREE, even here: the old URL now costs a redirect hop forever,
// any link or bookmark to it depends on the `slug_redirects` row surviving, and
// the platform's own rule puts a 90-day cooldown on reusing a released slug. It
// is the right call while this is demo data on a site nobody has linked to yet.
//
// Idempotent: a title/slug with no hub name left in it is skipped, so re-running
// is a no-op.

import { Prisma, SlugEntityType } from '@prisma/client';
import { renameEntitySlug } from '../../src/common/utils/slug-registry.util';
import { generateSlug } from '../../src/common/utils/slug.util';
import { log, prisma, section } from './_shared';

/**
 * The hubs whose name should not be repeated in the titles of the tours that
 * carry it. The hub row is the source of the phrase - we strip whatever the hub
 * is actually called, rather than a hard-coded string that could drift from it.
 */
const HUB_SLUGS = ['klein-curacao'];

/**
 * Connector words left dangling once a trailing place name is cut out - the
 * Spanish title "Charter privado en lancha rápida a Klein Curaçao" must not
 * come out as "...lancha rápida a". Accent-folded and lowercased before the
 * lookup, so 'à' and 'a' are the same entry. Covers the 7 platform locales.
 */
const DANGLING_CONNECTORS = new Set([
  // en
  'to',
  'at',
  'in',
  'on',
  'of',
  'the',
  'from',
  // nl
  'naar',
  'op',
  'bij',
  'van',
  'te',
  // de
  'nach',
  'auf',
  'zu',
  'zum',
  'zur',
  'an',
  'bei',
  // fr
  'a',
  'vers',
  'au',
  'aux',
  'de',
  'du',
  'en',
  'sur',
  // es
  'hacia',
  'del',
  'por',
  // pt
  'para',
  'em',
  'no',
  'na',
  'do',
  'da',
  'ao',
  // zh
  '前往',
  '到',
]);

/** Punctuation that only made sense as a separator next to the removed name. */
const EDGE_PUNCTUATION = /^[\s:;,\-–—|/·•]+|[\s:;,\-–—|/·•]+$/g;
const LEADING_SEPARATORS = /^[\s:;,\-–—|/·•]+/;
const TRAILING_SEPARATORS = /[\s:;,\-–—|/·•]+$/;

type Folded = { folded: string; map: number[] };

/**
 * Lowercase + strip diacritics, keeping an index back to the SOURCE character
 * for every character produced. NFD explodes 'ç' into 'c' + a combining
 * cedilla; dropping the mark leaves one surviving char per source char, so the
 * map lets us find a match on the folded text and then cut the ORIGINAL text at
 * the right place - accents, capitals and all.
 */
function fold(input: string): Folded {
  const folded: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const out = input[i]
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    // A source char can fold to nothing (a lone combining mark) or to more than
    // one char ('ß' -> 'ss'); record its index once per char it produced.
    for (const ch of out) {
      folded.push(ch);
      map.push(i);
    }
  }
  return { folded: folded.join(''), map };
}

/**
 * Trim the connector word(s) a removed place name was the object of, off the
 * end of the text that preceded it. Whitespace-delimited, so it never bites
 * into a word; leaves the text alone when nothing matches.
 */
function dropTrailingConnectors(left: string): string {
  let out = left.replace(/\s+$/, '');
  for (;;) {
    const at = out.lastIndexOf(' ');
    const lastWord = out.slice(at + 1).replace(EDGE_PUNCTUATION, '');
    if (!lastWord || !DANGLING_CONNECTORS.has(fold(lastWord).folded))
      return out;
    // Never consume the whole of `left` - a title that is nothing but a
    // connector is not an improvement on one with a place name in it.
    if (at === -1) return out;
    out = out.slice(0, at).replace(/\s+$/, '');
  }
}

/** Does `title` contain `phrase`, ignoring case and accents? */
export function containsPhrase(title: string, phrase: string): boolean {
  return fold(title).folded.includes(fold(phrase).folded);
}

/**
 * Remove every occurrence of `phrase` from `title` and tidy up what the cut
 * leaves behind: a dangling preposition, doubled spaces, and separator
 * punctuation that only existed to attach the name.
 *
 * Returns the original string when the phrase is not present, and `null` when
 * removing it would leave nothing worth calling a title (the caller keeps the
 * old value rather than blanking it).
 */
export function stripPhrase(title: string, phrase: string): string | null {
  const needle = fold(phrase).folded;
  if (!needle) return title;

  let out = title;
  // Re-fold each pass: one cut shifts every index after it.
  for (;;) {
    const { folded, map } = fold(out);
    const at = folded.indexOf(needle);
    if (at === -1) break;
    const start = map[at];
    const end = map[at + needle.length - 1] + 1;
    // Tidy AT THE CUT, not at the ends of the string: a metaTitle carries a
    // " | Island Tours" suffix, so the preposition the name was the object of
    // ("...lancha rápida a Klein Curaçao | Island Tours") is stranded in the
    // middle, where an end-of-string trim would never reach it.
    let left = dropTrailingConnectors(out.slice(0, start));
    let right = out.slice(end);
    if (right.trim() === '') left = left.replace(TRAILING_SEPARATORS, '');
    if (left.trim() === '') right = right.replace(LEADING_SEPARATORS, '');
    out =
      left.trim() && right.trim()
        ? `${left.replace(/\s+$/, '')} ${right.replace(/^\s+/, '')}`
        : left + right;
  }
  if (out === title) return title;

  out = out.replace(EDGE_PUNCTUATION, '').replace(/\s+/g, ' ').trim();

  if (out.length < 3) return null;

  // The name was often the first word, so the title can now start mid-sentence
  // ("journée complète en catamaran"). Non-cased scripts are unaffected.
  return out[0].toUpperCase() + out.slice(1);
}

type Change = { field: string; from: string; to: string };

/**
 * Bust the public site's `'use cache'` entries for the tours we just retitled.
 *
 * Without this the script is a no-op as far as anyone can SEE: the loaders hold
 * their entries for a `cacheLife` window, and a seed writes straight to Postgres
 * without passing through the dashboard, which is what normally announces a
 * change. Mirrors src/workers/public-cache.service.ts (same endpoint, same
 * header, same vocabulary) rather than importing it - this runs as a plain
 * script, with no Nest container to inject from.
 *
 * Best-effort by design: never throws, because the titles are already committed
 * and a missing frontend must not turn a successful write into a failed run.
 * The tour DETAIL loader tags itself `tour:<id>` only, so the coarse `tours` tag
 * alone would refresh every card on the site and leave the tour pages stale.
 */
async function revalidatePublicCache(tourIds: string[]): Promise<void> {
  const baseUrl = process.env.ISLAND_TOURS_URL?.trim();
  const secret = process.env.REVALIDATE_SECRET?.trim();
  // `slug-registry` guards the router's slug -> entity resolver: a renamed tour
  // whose resolver entry is still cached 404s on the new URL.
  const tags = [
    'tours',
    'search',
    'hubs',
    'slug-registry',
    ...tourIds.map((id) => `tour:${id}`),
  ];
  if (!baseUrl || !secret) {
    log(
      `Public cache NOT busted (${!baseUrl ? 'ISLAND_TOURS_URL' : 'REVALIDATE_SECRET'} unset) - the site keeps the old titles until its cacheLife expires.`,
    );
    return;
  }
  try {
    const res = await fetch(`${baseUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(10_000),
    });
    log(
      res.ok
        ? `Public cache busted (${tags.length} tags).`
        : `Public cache NOT busted (HTTP ${res.status}) - restart the site or wait out its cacheLife.`,
    );
  } catch (err) {
    log(
      `Public cache NOT busted (${err instanceof Error ? err.message : String(err)}) - is the site running on ${baseUrl}?`,
    );
  }
}

/**
 * Strip the hub names in HUB_SLUGS out of every tour title that carries one.
 *
 * @param opts.dryRun print the diff without writing.
 */
export async function stripHubNamesFromTourTitles(
  opts: { dryRun?: boolean } = {},
): Promise<void> {
  const dryRun = opts.dryRun ?? false;
  section(
    dryRun ? 'Tour titles - hub name (DRY RUN)' : 'Tour titles - hub name',
  );

  const hubs = await prisma.hub.findMany({
    where: { slug: { in: HUB_SLUGS } },
    select: {
      slug: true,
      name: true,
      translations: { select: { name: true } },
    },
  });
  if (hubs.length === 0) {
    log(`No hub found for ${HUB_SLUGS.join(', ')} - run the base seed first.`);
    return;
  }

  // The hub's own name, plus any localized name, longest first so that a
  // longer variant is cut before a shorter one that is a prefix of it.
  const phrases = [
    ...new Set(
      hubs
        .flatMap((h) => [h.name, ...h.translations.map((t) => t.name)])
        .map((n) => n?.trim())
        .filter((n): n is string => !!n),
    ),
  ].sort((a, b) => b.length - a.length);
  log(`Stripping: ${phrases.map((p) => `"${p}"`).join(', ')}`);

  // The hub's SLUG form, for the URL half of the job. Distinct from the name
  // phrases above: 'Klein Curaçao' never appears in a slug, 'klein-curacao' does.
  const slugPhrases = [...new Set(hubs.map((h) => h.slug))].sort(
    (a, b) => b.length - a.length,
  );

  const tours = await prisma.tour.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      h1Override: true,
      breadcrumbLabel: true,
      destination: { select: { slug: true } },
      translations: {
        select: { id: true, locale: true, title: true, metaTitle: true },
      },
    },
    orderBy: { slug: 'asc' },
  });

  const strip = (value: string): string | null => {
    let out: string | null = value;
    for (const phrase of phrases) {
      if (out === null) return null;
      out = stripPhrase(out, phrase);
    }
    return out;
  };

  /**
   * The new slug for a tour, or null when it does not carry a hub slug. Built by
   * cutting the hub slug out and re-normalizing through the SAME `generateSlug`
   * the tours service uses, so a leading/doubled hyphen cannot survive the cut.
   */
  const nextSlugFor = (slug: string): string | null => {
    let out = slug;
    for (const phrase of slugPhrases) out = out.split(phrase).join('-');
    if (out === slug) return null;
    const normalized = generateSlug(out);
    return normalized.length >= 3 ? normalized : null;
  };

  let toursChanged = 0;
  let rowsChanged = 0;
  let skipped = 0;
  const changedTourIds: string[] = [];
  let slugsRenamed = 0;

  for (const tour of tours) {
    const changes: Change[] = [];
    const tourData: Prisma.TourUpdateInput = {};
    const translationUpdates: {
      id: string;
      data: Prisma.TourTranslationUpdateInput;
    }[] = [];

    // The three title columns on the tour row itself. `h1Override` and
    // `breadcrumbLabel` are usually null (the page falls back to the title), but
    // when set they are the title as far as the reader is concerned.
    for (const field of ['name', 'h1Override', 'breadcrumbLabel'] as const) {
      const current = tour[field];
      if (!current) continue;
      const next = strip(current);
      if (next === null) {
        log(`! ${tour.slug} ${field}: stripping would empty it - left as is.`);
        skipped++;
        continue;
      }
      if (next === current) continue;
      tourData[field] = next;
      changes.push({ field, from: current, to: next });
    }

    for (const tr of tour.translations) {
      const data: Prisma.TourTranslationUpdateInput = {};
      for (const field of ['title', 'metaTitle'] as const) {
        const current = tr[field];
        if (!current) continue;
        const next = strip(current);
        if (next === null) {
          log(
            `! ${tour.slug} [${tr.locale}] ${field}: stripping would empty it - left as is.`,
          );
          skipped++;
          continue;
        }
        if (next === current) continue;
        data[field] = next;
        changes.push({
          field: `${tr.locale}.${field}`,
          from: current,
          to: next,
        });
      }
      if (Object.keys(data).length > 0) {
        translationUpdates.push({ id: tr.id, data });
      }
    }

    // The URL. Refused rather than forced on a collision: two tours cannot share
    // (destination, slug), and the registry reserves the name for categories,
    // hubs and collections too - so the check is against the REGISTRY, which
    // sees all four, not against the tours table, which sees one.
    const destinationSlug = tour.destination.slug;
    const oldSlug = tour.slug;
    let nextSlug = nextSlugFor(oldSlug);
    if (nextSlug) {
      const taken = await prisma.slugRegistry.findUnique({
        where: {
          destinationSlug_slug: { destinationSlug, slug: nextSlug },
        },
        select: { entityType: true, entityId: true },
      });
      if (taken && taken.entityId !== tour.id) {
        log(
          `! ${oldSlug}: /${destinationSlug}/${nextSlug}/ is already a ${taken.entityType} - slug left as is.`,
        );
        skipped++;
        nextSlug = null;
      }
    }
    if (nextSlug) {
      changes.push({ field: 'slug', from: oldSlug, to: nextSlug });
    }

    if (changes.length === 0) continue;
    toursChanged++;
    rowsChanged += changes.length;
    changedTourIds.push(tour.id);
    if (nextSlug) slugsRenamed++;

    log(`\n  ${tour.slug}`);
    for (const c of changes) {
      log(`    ${c.field}`);
      log(`      - ${c.from}`);
      log(`      + ${c.to}`);
    }

    if (dryRun) continue;

    await prisma.$transaction(async (tx) => {
      if (nextSlug) tourData.slug = nextSlug;
      if (Object.keys(tourData).length > 0) {
        await tx.tour.update({ where: { id: tour.id }, data: tourData });
      }
      for (const u of translationUpdates) {
        await tx.tourTranslation.update({ where: { id: u.id }, data: u.data });
      }
      if (!nextSlug) return;

      // Critical rule #4: the registry row moves in the SAME transaction as the
      // entity - a tour whose slug moved without its row is a live 404. This is
      // the SAME helper the tours/categories/hubs services call on a rename, so
      // a seed-driven rename and an admin-driven one leave identical state: the
      // registry re-pointed, a 301 old -> new, chains collapsed to one hop, and
      // any cooled-down ghost sitting on the target cleared.
      await renameEntitySlug(tx, {
        entityType: SlugEntityType.TOUR,
        entityId: tour.id,
        fromSlug: oldSlug,
        toSlug: nextSlug,
      });
    });
  }

  log('');
  if (toursChanged === 0) {
    log('Nothing to do - no tour title or slug carries a hub name.');
  } else {
    log(
      `${dryRun ? 'Would update' : 'Updated'} ${rowsChanged} field(s) across ${toursChanged} tour(s), of which ${slugsRenamed} slug(s) renamed (301 written for each old URL).`,
    );
  }
  if (skipped > 0) {
    log(`${skipped} field(s) left as is (would have been emptied).`);
  }
  if (!dryRun && changedTourIds.length > 0) {
    await revalidatePublicCache(changedTourIds);
  }
}
