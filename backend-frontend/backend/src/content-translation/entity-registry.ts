import { Injectable } from '@nestjs/common';
import { FaqPageType, Locale } from '@prisma/client';
import { TARGET_LOCALES } from '@/common/constants/translation.constants';
import { PrismaService } from '@/prisma/prisma.service';
import { TranslationClearMarkService } from './translation-clear-mark.service';
import { translationUnitKeys } from './translation-unit-keys';
import type { TranslatableValue } from './providers/translation-provider.interface';
import {
  MEDIA_BUCKET_PREFIX,
  MEDIA_BUCKET_SIZE,
  type ContentEntityType,
} from './content-translation.constants';

/**
 * Entity registry - turns one entity into its list of translation units.
 *
 * A unit is "one target row per locale in one table": a tour's main copy, one
 * highlight, one FAQ group, the About/SEO page content, one section group, one
 * collection-tour rationale. The unit carries its English source (already
 * filtered to non-empty values, proper-noun fields removed), what exists per
 * target locale (for the protect-human-edits policy) and a typed write-back.
 *
 * Source-of-truth reminders encoded here:
 * - The EN source lives in the `en` translation/per-locale row for every
 *   surface (entity create() does not seed one - a unit without an en row
 *   simply has an empty source and is skipped).
 * - `DestinationTranslation.name` / `HubTranslation.name` are proper nouns and
 *   NEVER enter a provider payload (master rule). Category/collection names DO
 *   translate, sourced from the en row's override or the base-row name.
 * - Tours have NO FAQs (hard house rule) - the tour collector builds no FAQ
 *   units even though FaqPageType.tour exists.
 * - Machine writes copy group attributes (displayOrder, isActive, sectionKey)
 *   from the English row so a translated FAQ/section keeps its place.
 */

export interface ExistingRow {
  isMachineTranslated: boolean;
  sourceHash: string | null;
}

export interface TranslationUnit {
  /** Stable id used as the JSON key prefix, e.g. 'main', 'highlight:<id>'. */
  key: string;
  source: Record<string, TranslatableValue>;
  existing: Partial<Record<Locale, ExistingRow>>;
  /**
   * Locales a human deliberately blanked in the Translation Console, from
   * `translation_clear_marks`. Only meaningful where `existing[locale]` is
   * absent: for NOT NULL surfaces a clear DELETES the row, and without this
   * the next run would read the gap as "never translated" and refill it.
   * Populated by `collect()`, never by the individual collectors.
   */
  cleared?: Partial<Record<Locale, true>>;
  /**
   * `machine: true` stamps isMachineTranslated + the sourceHash - the only
   * mode the service uses today, since human rows are skipped outright
   * (founder policy 2026-07-28: a cleared field stays cleared). The flag stays
   * in the signature so a write can be made non-stamping without touching
   * every unit implementation.
   */
  write(
    locale: Locale,
    fields: Record<string, TranslatableValue>,
    sourceHash: string,
    machine: boolean,
  ): Promise<void>;
}

type Row = Record<string, unknown>;

/** Non-empty string / non-empty string[] values of `keys`, in order. */
function pickSource(
  row: Row | null | undefined,
  keys: string[],
): Record<string, TranslatableValue> {
  const out: Record<string, TranslatableValue> = {};
  if (!row) return out;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) out[key] = value;
    else if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((v) => typeof v === 'string')
    ) {
      out[key] = value;
    }
  }
  return out;
}

/** Existing-rows map for a set of per-locale rows of one unit. */
function existingByLocale(
  rows: Array<
    Row & {
      locale: Locale;
      isMachineTranslated: boolean;
      sourceHash: string | null;
    }
  >,
  contentKeys: string[],
): Partial<Record<Locale, ExistingRow>> {
  const map: Partial<Record<Locale, ExistingRow>> = {};
  for (const row of rows) {
    if (row.locale === Locale.en) continue;
    map[row.locale] = {
      isMachineTranslated: row.isMachineTranslated,
      sourceHash: row.sourceHash,
    };
  }
  return map;
}

/** The machine-write bookkeeping, or nothing for a human-row gap-fill. */
function stamp(machine: boolean, sourceHash: string) {
  return machine ? { isMachineTranslated: true, sourceHash } : {};
}

const str = (
  f: Record<string, TranslatableValue>,
  k: string,
): string | undefined => (typeof f[k] === 'string' ? f[k] : undefined);

const arr = (
  f: Record<string, TranslatableValue>,
  k: string,
): string[] | undefined => (Array.isArray(f[k]) ? f[k] : undefined);

// Translatable field lists per table (source picking AND has-content checks).
const TOUR_FIELDS = [
  'title',
  'overview',
  'shortDescription',
  'whatToBring',
  'knowBeforeYouGo',
  'notSuitableFor',
  'whatToExpectIntro',
  'categoryDisplay',
  'localTipTitle',
  'localTipBody',
  'operatorNote',
  'meetingPointText',
  'metaTitle',
  'metaDescription',
];
const PAGE_CONTENT_FIELDS = ['aboutText', 'metaTitle', 'metaDescription'];
const FAQ_FIELDS = ['question', 'answer'];
const SECTION_FIELDS = ['heading', 'body'];
// Media library copy. All three translate (founder call 2026-07-31); `altText`
// is the one with public readers today.
const MEDIA_FIELDS = ['title', 'description', 'altText'];

@Injectable()
export class EntityRegistry {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clearMarks: TranslationClearMarkService,
  ) {}

  /** Null = the entity does not exist (deleted while a job sat in the queue). */
  async collect(
    entityType: ContentEntityType,
    entityId: string,
  ): Promise<TranslationUnit[] | null> {
    const units = await this.collectUnits(entityType, entityId);
    if (units === null) return null;
    await this.applyClearMarks(entityType, entityId, units);
    return units;
  }

  private collectUnits(
    entityType: ContentEntityType,
    entityId: string,
  ): Promise<TranslationUnit[] | null> {
    switch (entityType) {
      case 'tour':
        return this.collectTour(entityId);
      case 'category':
        return this.collectCategory(entityId);
      case 'destination':
        return this.collectDestination(entityId);
      case 'hub':
        return this.collectHub(entityId);
      case 'collection':
        return this.collectCollection(entityId);
      case 'homepage':
        return this.collectHomepage(entityId);
      case 'recommendation':
        return this.collectRecommendation(entityId);
      case 'media':
        return this.collectMedia(entityId);
    }
  }

  /**
   * Stamp each unit with the locales a human deliberately blanked, and prune
   * marks that have stopped meaning anything.
   *
   * A mark is only load-bearing while the row is ABSENT. Once a translation is
   * typed back in, the row's own `isMachineTranslated: false` is the policy
   * and the mark is stale - garbage-collect it here so a later wholesale
   * editor save (hub curation is delete-then-insert across all locales) cannot
   * resurrect a clear the admin has since undone.
   */
  private async applyClearMarks(
    entityType: ContentEntityType,
    entityId: string,
    units: TranslationUnit[],
  ): Promise<void> {
    const marks = await this.clearMarks.loadFor(entityType, entityId);
    if (marks.size === 0) return;

    const stale: Array<{ unitKey: string; locale: Locale }> = [];
    for (const unit of units) {
      for (const locale of TARGET_LOCALES) {
        if (locale === Locale.en) continue;
        if (!marks.has(TranslationClearMarkService.mapKey(unit.key, locale))) {
          continue;
        }
        if (unit.existing[locale]) stale.push({ unitKey: unit.key, locale });
        else (unit.cleared ??= {})[locale] = true;
      }
    }
    await this.clearMarks.forget(entityType, entityId, stale);
  }

  // ── Tour: main copy + 6 child surfaces (no FAQs - house rule) ──────────────

  private async collectTour(tourId: string): Promise<TranslationUnit[] | null> {
    const prisma = this.prisma;
    const tour = await prisma.tour.findUnique({
      where: { id: tourId },
      select: {
        id: true,
        translations: true,
        highlights: { select: { id: true, translations: true } },
        inclusions: { select: { id: true, translations: true } },
        exclusions: { select: { id: true, translations: true } },
        features: { select: { id: true, translations: true } },
        locations: { select: { id: true, translations: true } },
        pickupLocations: { select: { id: true, translations: true } },
      },
    });
    if (!tour) return null;

    const units: TranslationUnit[] = [];

    const enMain = tour.translations.find((t) => t.locale === Locale.en);
    units.push({
      key: translationUnitKeys.main(),
      source: pickSource(enMain, TOUR_FIELDS),
      existing: existingByLocale(tour.translations, TOUR_FIELDS),
      write: async (locale, f, sourceHash, machine) => {
        const data = {
          title: str(f, 'title'),
          overview: str(f, 'overview'),
          shortDescription: str(f, 'shortDescription'),
          whatToBring: arr(f, 'whatToBring'),
          knowBeforeYouGo: arr(f, 'knowBeforeYouGo'),
          notSuitableFor: arr(f, 'notSuitableFor'),
          whatToExpectIntro: str(f, 'whatToExpectIntro'),
          categoryDisplay: str(f, 'categoryDisplay'),
          localTipTitle: str(f, 'localTipTitle'),
          localTipBody: str(f, 'localTipBody'),
          operatorNote: str(f, 'operatorNote'),
          meetingPointText: str(f, 'meetingPointText'),
          metaTitle: str(f, 'metaTitle'),
          metaDescription: str(f, 'metaDescription'),
          ...stamp(machine, sourceHash),
        };
        await prisma.tourTranslation.upsert({
          where: { tourId_locale: { tourId, locale } },
          create: { tourId, locale, ...data },
          update: data,
        });
      },
    });

    for (const h of tour.highlights) {
      const en = h.translations.find((t) => t.locale === Locale.en);
      units.push({
        key: translationUnitKeys.highlight(h.id),
        source: pickSource(en, ['text']),
        existing: existingByLocale(h.translations, ['text']),
        write: async (locale, f, sourceHash, machine) => {
          const text = str(f, 'text');
          if (!text) return;
          const data = { text, ...stamp(machine, sourceHash) };
          await prisma.tourHighlightTranslation.upsert({
            where: { highlightId_locale: { highlightId: h.id, locale } },
            create: { highlightId: h.id, locale, ...data },
            update: data,
          });
        },
      });
    }

    for (const i of tour.inclusions) {
      const en = i.translations.find((t) => t.locale === Locale.en);
      units.push({
        key: translationUnitKeys.inclusion(i.id),
        source: pickSource(en, ['label']),
        existing: existingByLocale(i.translations, ['label']),
        write: async (locale, f, sourceHash, machine) => {
          const label = str(f, 'label');
          if (!label) return;
          const data = { label, ...stamp(machine, sourceHash) };
          await prisma.tourInclusionTranslation.upsert({
            where: { inclusionId_locale: { inclusionId: i.id, locale } },
            create: { inclusionId: i.id, locale, ...data },
            update: data,
          });
        },
      });
    }

    for (const e of tour.exclusions) {
      const en = e.translations.find((t) => t.locale === Locale.en);
      units.push({
        key: translationUnitKeys.exclusion(e.id),
        source: pickSource(en, ['label']),
        existing: existingByLocale(e.translations, ['label']),
        write: async (locale, f, sourceHash, machine) => {
          const label = str(f, 'label');
          if (!label) return;
          const data = { label, ...stamp(machine, sourceHash) };
          await prisma.tourExclusionTranslation.upsert({
            where: { exclusionId_locale: { exclusionId: e.id, locale } },
            create: { exclusionId: e.id, locale, ...data },
            update: data,
          });
        },
      });
    }

    for (const feat of tour.features) {
      const en = feat.translations.find((t) => t.locale === Locale.en);
      units.push({
        key: translationUnitKeys.feature(feat.id),
        source: pickSource(en, ['text']),
        existing: existingByLocale(feat.translations, ['text']),
        write: async (locale, f, sourceHash, machine) => {
          const text = str(f, 'text');
          if (!text) return;
          const data = { text, ...stamp(machine, sourceHash) };
          await prisma.tourFeatureTranslation.upsert({
            where: { featureId_locale: { featureId: feat.id, locale } },
            create: { featureId: feat.id, locale, ...data },
            update: data,
          });
        },
      });
    }

    for (const loc of tour.locations) {
      const en = loc.translations.find((t) => t.locale === Locale.en);
      units.push({
        key: translationUnitKeys.location(loc.id),
        source: pickSource(en, ['title', 'shortDescription']),
        existing: existingByLocale(loc.translations, [
          'title',
          'shortDescription',
        ]),
        write: async (locale, f, sourceHash, machine) => {
          const title = str(f, 'title');
          if (!title) return; // title is required on the row
          const data = {
            title,
            shortDescription: str(f, 'shortDescription'),
            ...stamp(machine, sourceHash),
          };
          await prisma.tourLocationTranslation.upsert({
            where: { locationId_locale: { locationId: loc.id, locale } },
            create: { locationId: loc.id, locale, ...data },
            update: data,
          });
        },
      });
    }

    for (const p of tour.pickupLocations) {
      const en = p.translations.find((t) => t.locale === Locale.en);
      units.push({
        key: translationUnitKeys.pickup(p.id),
        source: pickSource(en, ['title', 'directions']),
        existing: existingByLocale(p.translations, ['title', 'directions']),
        write: async (locale, f, sourceHash, machine) => {
          const title = str(f, 'title');
          if (!title) return; // title is required on the row
          const data = {
            title,
            directions: str(f, 'directions'),
            ...stamp(machine, sourceHash),
          };
          await prisma.pickupLocationTranslation.upsert({
            where: {
              pickupLocationId_locale: { pickupLocationId: p.id, locale },
            },
            create: { pickupLocationId: p.id, locale, ...data },
            update: data,
          });
        },
      });
    }

    return units;
  }

  // ── Content entities: main + page content + FAQ groups + sections ──────────

  private async collectCategory(id: string): Promise<TranslationUnit[] | null> {
    const prisma = this.prisma;
    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, translations: true, pageContents: true },
    });
    if (!category) return null;

    const fields = ['name', 'overview', 'h1Override', 'breadcrumbLabel'];
    const en = category.translations.find((t) => t.locale === Locale.en);
    // Category names translate; the canonical name lives on the base row and
    // the en translation row may override it.
    const source = pickSource(en, fields);
    if (!source.name && category.name.trim()) source.name = category.name;

    const units: TranslationUnit[] = [
      {
        key: translationUnitKeys.main(),
        source,
        existing: existingByLocale(category.translations, fields),
        write: async (locale, f, sourceHash, machine) => {
          const data = {
            name: str(f, 'name'),
            overview: str(f, 'overview'),
            h1Override: str(f, 'h1Override'),
            breadcrumbLabel: str(f, 'breadcrumbLabel'),
            ...stamp(machine, sourceHash),
          };
          await prisma.categoryTranslation.upsert({
            where: { categoryId_locale: { categoryId: id, locale } },
            create: { categoryId: id, locale, ...data },
            update: data,
          });
        },
      },
      this.pageContentUnit(category.pageContents, (locale, data) =>
        prisma.categoryPageContent
          .upsert({
            where: { categoryId_locale: { categoryId: id, locale } },
            create: { categoryId: id, locale, ...data },
            update: data,
          })
          .then(() => undefined),
      ),
    ];
    units.push(...(await this.faqUnits(FaqPageType.category, id)));
    units.push(...(await this.sectionUnits(FaqPageType.category, id)));
    return units;
  }

  private async collectDestination(
    id: string,
  ): Promise<TranslationUnit[] | null> {
    const prisma = this.prisma;
    const destination = await prisma.destination.findUnique({
      where: { id },
      select: { id: true, translations: true, pageContents: true },
    });
    if (!destination) return null;

    // `name` is a proper noun (master rule) - excluded from source AND from
    // has-content, so a machine refresh never touches an admin-set exonym.
    const fields = ['overview', 'h1Override', 'breadcrumbLabel'];
    const en = destination.translations.find((t) => t.locale === Locale.en);

    const units: TranslationUnit[] = [
      {
        key: translationUnitKeys.main(),
        source: pickSource(en, fields),
        existing: existingByLocale(destination.translations, fields),
        write: async (locale, f, sourceHash, machine) => {
          const data = {
            overview: str(f, 'overview'),
            h1Override: str(f, 'h1Override'),
            breadcrumbLabel: str(f, 'breadcrumbLabel'),
            ...stamp(machine, sourceHash),
          };
          await prisma.destinationTranslation.upsert({
            where: { destinationId_locale: { destinationId: id, locale } },
            create: { destinationId: id, locale, ...data },
            update: data,
          });
        },
      },
      this.pageContentUnit(destination.pageContents, (locale, data) =>
        prisma.destinationPageContent
          .upsert({
            where: { destinationId_locale: { destinationId: id, locale } },
            create: { destinationId: id, locale, ...data },
            update: data,
          })
          .then(() => undefined),
      ),
    ];
    units.push(...(await this.faqUnits(FaqPageType.destination, id)));
    units.push(...(await this.sectionUnits(FaqPageType.destination, id)));
    return units;
  }

  private async collectHub(id: string): Promise<TranslationUnit[] | null> {
    const prisma = this.prisma;
    const hub = await prisma.hub.findUnique({
      where: { id },
      select: {
        id: true,
        translations: true,
        pageContents: true,
        ourPicks: {
          select: { id: true, description: true, translations: true },
        },
        comparisonGroups: {
          select: {
            id: true,
            groupName: true,
            translations: true,
            comparisonTours: {
              select: { id: true, standoutNote: true, translations: true },
            },
          },
        },
        contentSections: true,
      },
    });
    if (!hub) return null;

    // `name` is a proper noun (Klein Curaçao) - never machine-translated.
    const fields = ['overview', 'heroTagline', 'h1Override', 'breadcrumbLabel'];
    const en = hub.translations.find((t) => t.locale === Locale.en);

    const units: TranslationUnit[] = [
      {
        key: translationUnitKeys.main(),
        source: pickSource(en, fields),
        existing: existingByLocale(hub.translations, fields),
        write: async (locale, f, sourceHash, machine) => {
          const data = {
            overview: str(f, 'overview'),
            heroTagline: str(f, 'heroTagline'),
            h1Override: str(f, 'h1Override'),
            breadcrumbLabel: str(f, 'breadcrumbLabel'),
            ...stamp(machine, sourceHash),
          };
          await prisma.hubTranslation.upsert({
            where: { hubId_locale: { hubId: id, locale } },
            create: { hubId: id, locale, ...data },
            update: data,
          });
        },
      },
      this.pageContentUnit(hub.pageContents, (locale, data) =>
        prisma.hubPageContent
          .upsert({
            where: { hubId_locale: { hubId: id, locale } },
            create: { hubId: id, locale, ...data },
            update: data,
          })
          .then(() => undefined),
      ),
    ];

    // Curation-tab surfaces (hub editor). The EN source for picks/comparison
    // lives on the BASE row (the per-locale tables hold only translations);
    // both are replaced wholesale by their editors, so unit keys use the
    // current row ids - identity across saves is handled by the hub service's
    // flag preservation, not here.
    for (const pick of hub.ourPicks) {
      units.push({
        key: translationUnitKeys.ourPick(pick.id),
        source: pickSource(pick, ['description']),
        existing: existingByLocale(pick.translations, ['description']),
        write: async (locale, f, sourceHash, machine) => {
          const description = str(f, 'description');
          if (!description) return;
          const data = { description, ...stamp(machine, sourceHash) };
          await prisma.hubOurPickTranslation.upsert({
            where: { ourPickId_locale: { ourPickId: pick.id, locale } },
            create: { ourPickId: pick.id, locale, ...data },
            update: data,
          });
        },
      });
    }

    for (const group of hub.comparisonGroups) {
      units.push({
        key: translationUnitKeys.comparisonGroup(group.id),
        source: pickSource(group, ['groupName']),
        existing: existingByLocale(group.translations, ['groupName']),
        write: async (locale, f, sourceHash, machine) => {
          const groupName = str(f, 'groupName');
          if (!groupName) return;
          const data = { groupName, ...stamp(machine, sourceHash) };
          await prisma.hubComparisonGroupTranslation.upsert({
            where: { groupId_locale: { groupId: group.id, locale } },
            create: { groupId: group.id, locale, ...data },
            update: data,
          });
        },
      });
      for (const ct of group.comparisonTours) {
        units.push({
          key: translationUnitKeys.comparisonTour(ct.id),
          source: pickSource(ct, ['standoutNote']),
          existing: existingByLocale(ct.translations, ['standoutNote']),
          write: async (locale, f, sourceHash, machine) => {
            const standoutNote = str(f, 'standoutNote');
            if (!standoutNote) return;
            const data = { standoutNote, ...stamp(machine, sourceHash) };
            await prisma.hubComparisonTourTranslation.upsert({
              where: {
                comparisonTourId_locale: { comparisonTourId: ct.id, locale },
              },
              create: { comparisonTourId: ct.id, locale, ...data },
              update: data,
            });
          },
        });
      }
    }

    // Content sections carry their locale ON the row (no FK group key). The
    // logical identity of a block across locales is (sectionType,
    // displayOrder) - the exact convention the dashboard editor groups by, and
    // what its save regenerates per type. Headingless block types store the
    // body copied into `heading` (dashboard convention) - translate the body
    // once and mirror it, instead of paying for the same text twice.
    for (const section of hub.contentSections) {
      if (section.locale !== Locale.en) continue;
      const headingIsBody = section.heading === section.body;
      const fields = headingIsBody ? ['body'] : SECTION_FIELDS;
      const siblings = hub.contentSections.filter(
        (s) =>
          s.sectionType === section.sectionType &&
          s.displayOrder === section.displayOrder,
      );
      units.push({
        key: translationUnitKeys.hubSection(
          section.sectionType,
          section.displayOrder,
        ),
        source: pickSource(section, fields),
        existing: existingByLocale(siblings, fields),
        write: async (locale, f, sourceHash, machine) => {
          const body = str(f, 'body');
          const heading = headingIsBody ? body : str(f, 'heading');
          const target = siblings.find((s) => s.locale === locale);
          if (target) {
            await prisma.hubContentSection.update({
              where: { id: target.id },
              data: { heading, body, ...stamp(machine, sourceHash) },
            });
            return;
          }
          // A new locale row needs the full block (heading is NOT NULL).
          if (!body || !heading) return;
          await prisma.hubContentSection.create({
            data: {
              hubId: id,
              locale,
              sectionType: section.sectionType,
              heading,
              body,
              image: section.image,
              displayOrder: section.displayOrder,
              ...stamp(machine, sourceHash),
            },
          });
        },
      });
    }

    units.push(...(await this.faqUnits(FaqPageType.hub, id)));
    units.push(...(await this.sectionUnits(FaqPageType.hub, id)));
    return units;
  }

  private async collectCollection(
    id: string,
  ): Promise<TranslationUnit[] | null> {
    const prisma = this.prisma;
    const collection = await prisma.collection.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        translations: true,
        pageContents: true,
        collectionTours: {
          select: { id: true, translations: true },
        },
      },
    });
    if (!collection) return null;

    const fields = [
      'name',
      'overview',
      'curationNote',
      'eyebrowLabel',
      'h1Override',
      'breadcrumbLabel',
    ];
    const en = collection.translations.find((t) => t.locale === Locale.en);
    const source = pickSource(en, fields);
    if (!source.name && collection.name.trim()) source.name = collection.name;

    const units: TranslationUnit[] = [
      {
        key: translationUnitKeys.main(),
        source,
        existing: existingByLocale(collection.translations, fields),
        write: async (locale, f, sourceHash, machine) => {
          const data = {
            name: str(f, 'name'),
            overview: str(f, 'overview'),
            curationNote: str(f, 'curationNote'),
            eyebrowLabel: str(f, 'eyebrowLabel'),
            h1Override: str(f, 'h1Override'),
            breadcrumbLabel: str(f, 'breadcrumbLabel'),
            ...stamp(machine, sourceHash),
          };
          await prisma.collectionTranslation.upsert({
            where: { collectionId_locale: { collectionId: id, locale } },
            create: { collectionId: id, locale, ...data },
            update: data,
          });
        },
      },
      this.pageContentUnit(collection.pageContents, (locale, data) =>
        prisma.collectionPageContent
          .upsert({
            where: { collectionId_locale: { collectionId: id, locale } },
            create: { collectionId: id, locale, ...data },
            update: data,
          })
          .then(() => undefined),
      ),
    ];

    for (const ct of collection.collectionTours) {
      const enRationale = ct.translations.find((t) => t.locale === Locale.en);
      units.push({
        key: translationUnitKeys.rationale(ct.id),
        source: pickSource(enRationale, ['rationale']),
        existing: existingByLocale(ct.translations, ['rationale']),
        write: async (locale, f, sourceHash, machine) => {
          const rationale = str(f, 'rationale');
          if (!rationale) return;
          const data = { rationale, ...stamp(machine, sourceHash) };
          await prisma.collectionTourRationale.upsert({
            where: {
              collectionTourId_locale: { collectionTourId: ct.id, locale },
            },
            create: { collectionTourId: ct.id, locale, ...data },
            update: data,
          });
        },
      });
    }

    units.push(...(await this.faqUnits(FaqPageType.collection, id)));
    units.push(...(await this.sectionUnits(FaqPageType.collection, id)));
    return units;
  }

  private async collectHomepage(id: string): Promise<TranslationUnit[] | null> {
    const prisma = this.prisma;
    const home = await prisma.homePage.findUnique({
      where: { id },
      select: { id: true, translations: true },
    });
    if (!home) return null;

    const fields = [
      'heroTitle',
      'heroSubtitle',
      'experiencesTitle',
      'editorialTitleLine1',
      'editorialTitleLine2',
      'editorialBody',
      'editorialCta',
      'faqTitle',
      'faqSubtitle',
      'metaTitle',
      'metaDescription',
    ];
    const en = home.translations.find((t) => t.locale === Locale.en);

    const units: TranslationUnit[] = [
      {
        key: translationUnitKeys.main(),
        source: pickSource(en, fields),
        existing: existingByLocale(home.translations, fields),
        write: async (locale, f, sourceHash, machine) => {
          const data = {
            heroTitle: str(f, 'heroTitle'),
            heroSubtitle: str(f, 'heroSubtitle'),
            experiencesTitle: str(f, 'experiencesTitle'),
            editorialTitleLine1: str(f, 'editorialTitleLine1'),
            editorialTitleLine2: str(f, 'editorialTitleLine2'),
            editorialBody: str(f, 'editorialBody'),
            editorialCta: str(f, 'editorialCta'),
            faqTitle: str(f, 'faqTitle'),
            faqSubtitle: str(f, 'faqSubtitle'),
            metaTitle: str(f, 'metaTitle'),
            metaDescription: str(f, 'metaDescription'),
            ...stamp(machine, sourceHash),
          };
          await prisma.homePageTranslation.upsert({
            where: { homeId_locale: { homeId: home.id, locale } },
            create: { homeId: home.id, locale, ...data },
            update: data,
          });
        },
      },
    ];
    units.push(...(await this.faqUnits(FaqPageType.homepage, home.id)));
    return units;
  }

  /**
   * Island Tours' post-booking recommendations (thank-you page / email promo).
   *
   * One unit, no sub-surfaces: no FAQs, no page-content sections. The NUMBERS
   * (rating, review count, sleeps, price) are deliberately absent - they live on
   * the parent record because they are the same fact in every language, and
   * handing them to a translation provider would invite it to "localise" a price.
   * Only prose travels: the eyebrow, the area, the title, the pitch and the CTA
   * label. INTERNAL recommendations follow their entity and usually carry no copy;
   * when they carry an override it is translated like any other.
   */
  private async collectRecommendation(
    id: string,
  ): Promise<TranslationUnit[] | null> {
    const prisma = this.prisma;
    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      select: { id: true, translations: true },
    });
    if (!recommendation) return null;

    const fields = ['eyebrow', 'areaLabel', 'title', 'description', 'ctaLabel'];
    const en = recommendation.translations.find((t) => t.locale === Locale.en);

    return [
      {
        key: translationUnitKeys.main(),
        source: pickSource(en, fields),
        existing: existingByLocale(recommendation.translations, fields),
        write: async (locale, f, sourceHash, machine) => {
          const data = {
            eyebrow: str(f, 'eyebrow'),
            areaLabel: str(f, 'areaLabel'),
            title: str(f, 'title'),
            description: str(f, 'description'),
            ctaLabel: str(f, 'ctaLabel'),
            ...stamp(machine, sourceHash),
          };
          await prisma.recommendationTranslation.upsert({
            where: {
              recommendationId_locale: {
                recommendationId: recommendation.id,
                locale,
              },
            },
            create: {
              recommendationId: recommendation.id,
              locale,
              ...data,
            },
            update: data,
          });
        },
      },
    ];
  }

  // ── Media library: MANY assets per job ──────────────────────────────────────

  /**
   * Media assets, as one unit per asset.
   *
   * `key` is either a media uuid (the manual per-asset button) or
   * `bucket:<hex>` - the only entityId in the pipeline that stands for more than
   * one row. The batching exists because `ContentTranslationService` makes ONE
   * provider call per locale per entity regardless of unit count: fifty assets in
   * one job cost 6 calls, where fifty per-asset jobs would cost 300. On a ~1k
   * requests/day free tier that is the difference between a library of thousands
   * being translatable and not.
   *
   * The English source is the `MediaGallery` row ITSELF, not an `en` translation
   * row (the hub our-picks shape), so `pickSource` reads the base row.
   *
   * Bucket ordering is least-translated-first, which makes a bucket
   * self-draining: assets already done sort to the back and fall outside the
   * window once a bucket holds more than MEDIA_BUCKET_SIZE candidates. Ordering
   * by `updatedAt` instead would re-offer the same fifty finished assets forever
   * and never reach the fifty-first.
   *
   * Media needs no clear-mark handling: its columns are NULLABLE, so a cleared
   * field keeps its row (flagged human) and the policy reads it straight off the
   * row. `applyClearMarks` runs anyway and finds nothing, which is correct.
   */
  private async collectMedia(key: string): Promise<TranslationUnit[] | null> {
    const prisma = this.prisma;
    const isBucket = key.startsWith(MEDIA_BUCKET_PREFIX);

    const select = {
      id: true,
      title: true,
      description: true,
      altText: true,
      translations: {
        select: {
          locale: true,
          title: true,
          description: true,
          altText: true,
          isMachineTranslated: true,
          sourceHash: true,
        },
      },
    } as const;

    const rows = isBucket
      ? await prisma.mediaGallery.findMany({
          where: {
            id: { startsWith: key.slice(MEDIA_BUCKET_PREFIX.length) },
            // Nothing to translate without English copy to translate FROM.
            OR: [
              { title: { not: null } },
              { description: { not: null } },
              { altText: { not: null } },
            ],
          },
          select,
          orderBy: [{ translations: { _count: 'asc' } }, { updatedAt: 'desc' }],
          take: MEDIA_BUCKET_SIZE,
        })
      : await prisma.mediaGallery.findMany({ where: { id: key }, select });

    // A bucket that is empty (or fully done) is a no-op, NOT a missing entity -
    // returning null would log it as "deleted while queued". A single asset that
    // is gone genuinely is.
    if (rows.length === 0) return isBucket ? [] : null;

    return rows.map((row) => ({
      key: translationUnitKeys.media(row.id),
      source: pickSource(row, MEDIA_FIELDS),
      existing: existingByLocale(row.translations, MEDIA_FIELDS),
      write: async (locale, f, sourceHash, machine) => {
        const data = {
          title: str(f, 'title'),
          description: str(f, 'description'),
          altText: str(f, 'altText'),
          ...stamp(machine, sourceHash),
        };
        await prisma.mediaTranslation.upsert({
          where: { mediaId_locale: { mediaId: row.id, locale } },
          create: { mediaId: row.id, locale, ...data },
          update: data,
        });
      },
    }));
  }

  // ── Shared sub-surface collectors ───────────────────────────────────────────

  /** One unit for the About/SEO page-content record (rows already loaded). */
  private pageContentUnit(
    rows: Array<
      Row & {
        locale: Locale;
        isMachineTranslated: boolean;
        sourceHash: string | null;
      }
    >,
    upsert: (
      locale: Locale,
      data: {
        aboutText: string | undefined;
        metaTitle: string | undefined;
        metaDescription: string | undefined;
        // Absent on a human-row gap-fill (see TranslationUnit.write).
        isMachineTranslated?: boolean;
        sourceHash?: string;
      },
    ) => Promise<void>,
  ): TranslationUnit {
    const en = rows.find((r) => r.locale === Locale.en);
    return {
      key: translationUnitKeys.pageContent(),
      source: pickSource(en, PAGE_CONTENT_FIELDS),
      existing: existingByLocale(rows, PAGE_CONTENT_FIELDS),
      write: (locale, f, sourceHash, machine) =>
        upsert(locale, {
          aboutText: str(f, 'aboutText'),
          metaTitle: str(f, 'metaTitle'),
          metaDescription: str(f, 'metaDescription'),
          ...stamp(machine, sourceHash),
        }),
    };
  }

  /**
   * One unit per FAQ group. Legacy rows without a faqGroupId cannot be grouped
   * across locales and are skipped.
   */
  private async faqUnits(
    pageType: FaqPageType,
    entityId: string,
  ): Promise<TranslationUnit[]> {
    const prisma = this.prisma;
    const rows = await prisma.faq.findMany({
      where: { pageType, entityId, faqGroupId: { not: null } },
      orderBy: { displayOrder: 'asc' },
    });
    const byGroup = new Map<string, typeof rows>();
    for (const row of rows) {
      const group = byGroup.get(row.faqGroupId as string) ?? [];
      group.push(row);
      byGroup.set(row.faqGroupId as string, group);
    }

    return [...byGroup.entries()].map(([groupId, group]) => {
      const en = group.find((r) => r.locale === Locale.en);
      return {
        key: translationUnitKeys.faq(groupId),
        source: pickSource(en, FAQ_FIELDS),
        existing: existingByLocale(group, FAQ_FIELDS),
        write: async (locale, f, sourceHash, machine) => {
          const question = str(f, 'question');
          const answer = str(f, 'answer');
          if (!question || !answer) return; // both required on the row
          await prisma.faq.upsert({
            where: {
              pageType_entityId_faqGroupId_locale: {
                pageType,
                entityId,
                faqGroupId: groupId,
                locale,
              },
            },
            create: {
              pageType,
              entityId,
              faqGroupId: groupId,
              locale,
              question,
              answer,
              // Group attributes ride the English row.
              displayOrder: en?.displayOrder ?? 0,
              isActive: en?.isActive ?? true,
              ...stamp(machine, sourceHash),
            },
            update: {
              question,
              answer,
              ...stamp(machine, sourceHash),
            },
          });
        },
      };
    });
  }

  /** One unit per page-content-section group (destination About band etc.). */
  private async sectionUnits(
    pageType: FaqPageType,
    entityId: string,
  ): Promise<TranslationUnit[]> {
    const prisma = this.prisma;
    const rows = await prisma.pageContentSection.findMany({
      where: { pageType, entityId },
      orderBy: { displayOrder: 'asc' },
    });
    const byGroup = new Map<string, typeof rows>();
    for (const row of rows) {
      const group = byGroup.get(row.sectionGroupId) ?? [];
      group.push(row);
      byGroup.set(row.sectionGroupId, group);
    }

    return [...byGroup.entries()].map(([groupId, group]) => {
      const en = group.find((r) => r.locale === Locale.en);
      return {
        key: translationUnitKeys.section(groupId),
        source: pickSource(en, SECTION_FIELDS),
        existing: existingByLocale(group, SECTION_FIELDS),
        write: async (locale, f, sourceHash, machine) => {
          const heading = str(f, 'heading');
          const body = str(f, 'body');
          if (!heading || !body) return; // both required on the row
          await prisma.pageContentSection.upsert({
            where: {
              pageType_entityId_sectionGroupId_locale: {
                pageType,
                entityId,
                sectionGroupId: groupId,
                locale,
              },
            },
            create: {
              pageType,
              entityId,
              sectionGroupId: groupId,
              locale,
              heading,
              body,
              // Group attributes ride the English row.
              sectionKey: en?.sectionKey ?? null,
              displayOrder: en?.displayOrder ?? 0,
              isActive: en?.isActive ?? true,
              ...stamp(machine, sourceHash),
            },
            update: {
              heading,
              body,
              ...stamp(machine, sourceHash),
            },
          });
        },
      };
    });
  }
}
