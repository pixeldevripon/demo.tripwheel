import { isPlatformWideRole } from '@/common/utils/operator.util';
import { PrismaService } from '@/prisma/prisma.service';
import { InboxService } from '@/inbox/inbox.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  InboxEvent,
  OperatorTermsKind,
  PendingChangeStatus,
  Prisma,
  Role,
  TourStatus,
} from '@prisma/client';
import { htmlHasText, resolveLocaleText } from './operator-terms.util';
import { randomUUID } from 'crypto';

/** The subset of `source` whose keys are in `keys` AND defined. */
function pickKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/**
 * Live-tour content gate (client review #19 / dashboard #80).
 *
 * What it does: holds an operator's edits to a LIVE tour's title, description
 * content (TourTranslation fields) and photos in a pending-change row instead
 * of applying them - travellers keep seeing the last approved version and the
 * tour never goes offline. Price and booking cutoff are the deliberate
 * instant lanes; the free-cancellation window is admin-only on a published
 * tour (both enforced in ToursService, not here).
 *
 * Dependencies: PrismaService (pending rows + apply-on-approve),
 * InboxService (submit/approve/reject notifications - the events are the
 * same TOUR_* review events, with content-change titles and dedupe keys).
 *
 * Usage: ToursService and TourChildrenService call `isGated` + `stash` /
 * the staged-image ops from their write paths; the admin queue and the
 * approve/reject decisions come through the controller directly.
 */

/** One staged gallery entry - mirrors TourChildrenService.imageSelect. */
export interface StagedImage {
  id: string;
  url: string;
  isHero: boolean;
  focalX: number;
  focalY: number;
  altText: string | null;
  displayOrder: number;
  width: number;
  height: number;
  /** True when the image was added while staged (no TourImage row yet). */
  isNew?: boolean;
}

/**
 * The itemized content child entities the gate covers (client feedback
 * 2026-08-15: EVERY content change must be recorded and diffed - lists and
 * their translations included). Pickup zones, age bands, add-ons, languages
 * and schedules stay instant: they are the pricing/operational lane the
 * client explicitly wants operators to move without review.
 */
export type StagedListKind =
  | 'highlights'
  | 'inclusions'
  | 'exclusions'
  | 'features'
  | 'locations';

interface ListConfig {
  /** Row columns the staged copy carries (id/tourId/translations aside). */
  baseFields: readonly string[];
  /** Translation-row columns (locale/isMachineTranslated aside). */
  trFields: readonly string[];
  /** Prisma delegate keys + the translation row's FK column. */
  delegate: string;
  trDelegate: string;
  trFk: string;
}

export const LIST_CONFIG: Record<StagedListKind, ListConfig> = {
  highlights: {
    baseFields: ['displayOrder', 'imageUrl'],
    trFields: ['text'],
    delegate: 'tourHighlight',
    trDelegate: 'tourHighlightTranslation',
    trFk: 'highlightId',
  },
  inclusions: {
    baseFields: ['icon', 'displayOrder', 'imageUrl'],
    trFields: ['label'],
    delegate: 'tourInclusion',
    trDelegate: 'tourInclusionTranslation',
    trFk: 'inclusionId',
  },
  exclusions: {
    baseFields: ['icon', 'type', 'priceText', 'displayOrder', 'imageUrl'],
    trFields: ['label'],
    delegate: 'tourExclusion',
    trDelegate: 'tourExclusionTranslation',
    trFk: 'exclusionId',
  },
  features: {
    baseFields: ['type', 'displayOrder'],
    trFields: ['text'],
    delegate: 'tourFeature',
    trDelegate: 'tourFeatureTranslation',
    trFk: 'featureId',
  },
  locations: {
    baseFields: [
      'types',
      'latitude',
      'longitude',
      'streetAddress',
      'addressLocality',
      'addressRegion',
      'postalCode',
      'addressCountry',
      'minutesTo',
      'minutesAt',
      'displayOrder',
    ],
    trFields: ['title', 'shortDescription'],
    delegate: 'tourLocation',
    trDelegate: 'tourLocationTranslation',
    trFk: 'locationId',
  },
};

/** One staged translation entry - locale plus that kind's trFields. */
export type StagedItemTranslation = { locale: string } & Record<
  string,
  unknown
>;

/**
 * One staged list item - mirrors the list GETs' select shape (flat base
 * columns + a translations array), so the staged read is indistinguishable
 * from the real one. Translations carry EVERY locale, so per-item
 * translation edits on a live tour are held too.
 */
export interface StagedListItem extends Record<string, unknown> {
  id: string;
  translations: StagedItemTranslation[];
  /** True when the item was added while staged (no DB row yet). */
  isNew?: boolean;
}

/**
 * The staged operator-conditions gate (Pastel #80): the WHOLE desired state.
 * `kind: null` proposes removing the gate; items and the document ride as
 * full locale maps so approve applies exactly what the diff showed. The
 * document map holds sanitized TipTap HTML (the PAGES pipeline reused:
 * `sanitizePageHtml` ran at write time) and lives on the OPERATOR row - one
 * document per operator - so approving it applies cross-entity.
 */
export interface StagedConditions extends Record<string, unknown> {
  kind: OperatorTermsKind | null;
  acknowledgmentItems: Record<string, string[]> | null;
  document: Record<string, string> | null;
  /**
   * Bookkeeping, never applied: the OPERATOR's termsDocument as it stood when
   * this unit was (re)staged. The document is shared across the operator's
   * tours, so approve() compare-and-swaps against this - two tours' proposals
   * built on the same original must not silently overwrite each other's
   * approval (code review, wave 3). `undefined` on pre-CAS rows = no check.
   */
  documentBase?: Record<string, string> | null;
}

export interface PendingChangePayload {
  tour?: { name?: string };
  /** Per-locale UpsertTourTranslationDto fields (defined fields only). */
  translations?: Record<string, Record<string, unknown>>;
  /** The STAGED COPY of the whole gallery, when photos were touched. */
  images?: StagedImage[];
  /** Staged copies of the itemized lists - whole desired state per kind. */
  lists?: Partial<Record<StagedListKind, StagedListItem[]>>;
  /** The staged operator-conditions gate change (Pastel #80). */
  conditions?: StagedConditions;
  /**
   * Bookkeeping, never applied: `fieldTimes` stamps WHEN each unit was last
   * staged (client ask: per-change timestamps, not one for the whole set).
   * Keys: 'title' | 'photos' | 'conditions' | `tr:{locale}:{field}` |
   * `list:{kind}`.
   */
  meta?: { fieldTimes?: Record<string, string> };
}

/** Add/refresh (set=true) or drop (set=false) one fieldTimes stamp. */
function withFieldTime(
  meta: PendingChangePayload['meta'],
  key: string,
  set: boolean,
): PendingChangePayload['meta'] {
  const fieldTimes = { ...meta?.fieldTimes };
  if (set) fieldTimes[key] = new Date().toISOString();
  else delete fieldTimes[key];
  return Object.keys(fieldTimes).length > 0 ? { fieldTimes } : undefined;
}

/** The areas a change set touches - drives the queue's "what changed" chips. */
export type ChangedArea =
  | 'title'
  | 'content'
  | 'photos'
  | 'conditions'
  | StagedListKind;

/** The LIVE counterparts of an open set's kept fields - what the diff view
 *  renders against, for the operator as much as the reviewer. */
export interface PendingChangeCurrentValues {
  tour?: { name: string | null };
  translations?: Record<string, Record<string, unknown>>;
  images?: Omit<StagedImage, 'isNew'>[];
  lists?: Partial<Record<StagedListKind, Omit<StagedListItem, 'isNew'>[]>>;
  conditions?: StagedConditions;
}

/** Bounds each staged list, like MAX_STAGED_IMAGES bounds the gallery. */
export const MAX_STAGED_LIST_ITEMS = 40;

/**
 * The ONLY TourTranslation columns a pending set may carry - enforced at
 * stash time (TourChildrenService.definedTranslationFields) AND re-enforced
 * at apply time in approve(), so the two enforcement points cannot drift
 * (security review #80): a payload key outside this list is dropped, never
 * spread into the upsert.
 */
export const TRANSLATION_CONTENT_KEYS = [
  'title',
  'overview',
  'description',
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
] as const;

/** Matches the dashboard Images tab's own gallery ceiling - and bounds the
 *  staged JSONB payload (security review #80: unbounded growth was a
 *  write-amplification DoS). */
export const MAX_STAGED_IMAGES = 24;

type PendingChangeRow = Prisma.TourPendingChangeGetPayload<{
  select: typeof pendingChangeSelect;
}>;

const pendingChangeSelect = {
  id: true,
  tourId: true,
  status: true,
  payload: true,
  submittedAt: true,
  submittedById: true,
  decidedAt: true,
  decidedById: true,
  reviewNote: true,
  updatedAt: true,
} as const;

@Injectable()
export class TourPendingChangesService {
  private readonly logger = new Logger(TourPendingChangesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
    private readonly contentTranslation: ContentTranslationEnqueuer,
  ) {}

  /**
   * The gate itself: a LIVE tour's content edits by anyone who is not
   * platform-side are held for review. Platform staff (ADMIN/STAFF/EDITOR)
   * edit directly - they ARE the reviewers.
   */
  isGated(tourStatus: TourStatus, requesterRole: Role): boolean {
    return tourStatus === TourStatus.LIVE && !isPlatformWideRole(requesterRole);
  }

  changedAreas(payload: PendingChangePayload): ChangedArea[] {
    const areas: ChangedArea[] = [];
    if (payload.tour?.name !== undefined) areas.push('title');
    if (payload.translations && Object.keys(payload.translations).length > 0)
      areas.push('content');
    if (payload.images) areas.push('photos');
    if (payload.conditions) areas.push('conditions');
    // EVERY configured kind - hand-listing three of five silently dropped
    // the features/locations chips (code review round 4).
    for (const kind of Object.keys(LIST_CONFIG) as StagedListKind[]) {
      if (payload.lists?.[kind]) areas.push(kind);
    }
    return areas;
  }

  /** True when the payload proposes nothing for `kind`'s sibling areas
   *  either - see isEmptyPayload. */
  private hasAnyList(p: PendingChangePayload): boolean {
    return !!p.lists && Object.keys(p.lists).length > 0;
  }

  /** The open (PENDING) change set for a tour, or null. */
  async getOpenForTour(tourId: string) {
    return this.prisma.tourPendingChange.findFirst({
      where: { tourId, status: PendingChangeStatus.PENDING },
      select: pendingChangeSelect,
    });
  }

  /**
   * The operator's WORKING set: the open PENDING one, or - when the tour's
   * LAST word is a rejection - that rejected set. A rejection sends the
   * proposal back, it does not erase it (client round 6: "fix one key and
   * save" lost every other edit): reads keep overlaying the rejected draft
   * and the next save revives it. A rejected set superseded by a newer
   * approved one stays history (the latest-row check handles that).
   */
  async getWorkingSetForTour(tourId: string) {
    const open = await this.getOpenForTour(tourId);
    if (open) return open;
    const latest = await this.prisma.tourPendingChange.findFirst({
      where: { tourId },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      select: pendingChangeSelect,
    });
    return latest?.status === PendingChangeStatus.REJECTED ? latest : null;
  }

  /**
   * The latest change set regardless of status - the operator's wizard shows
   * an open set as "waiting for review" and a decided one as its verdict.
   * The OPEN set wins outright when one exists (the partial unique index
   * guarantees at most one), which also sidesteps same-millisecond
   * submittedAt ties between a rejected set and its fast resubmission
   * (code-review #80 finding 4); the decided fallback tiebreaks on id.
   *
   * An open set is PRUNED against the live rows before it is returned (UX
   * round 3): sets stashed before the diff-pruning fix carry every form
   * field, and the operator's proposed-only view cannot filter that noise
   * client-side. The healed payload is persisted, and a set that prunes to
   * nothing is withdrawn - the fallback then serves the latest decided one.
   */
  async getLatestForTour(tourId: string) {
    const open = await this.getOpenForTour(tourId);
    if (open) {
      const pruned = await this.pruneOpenAgainstLive(open);
      if (pruned) {
        return {
          ...pruned.row,
          changedAreas: this.changedAreas(
            pruned.row.payload as PendingChangePayload,
          ),
          // The live counterparts of every kept field, collected during the
          // prune - BOTH roles diff against this one consistent snapshot
          // (the operator's own reads are overlaid with the proposal, so
          // without it they could never see what actually changes).
          current: pruned.current,
        };
      }
    }
    const row = await this.prisma.tourPendingChange.findFirst({
      where: { tourId },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      select: pendingChangeSelect,
    });
    if (!row) return null;
    return {
      ...row,
      changedAreas: this.changedAreas(row.payload as PendingChangePayload),
      // A SENT-BACK set keeps its diff (client ask: the note without the
      // changes it is about is unreadable) - collect the live counterparts
      // for it too, read-only, no prune.
      ...(row.status === PendingChangeStatus.REJECTED
        ? {
            current: await this.collectCurrentValues(
              tourId,
              row.payload as PendingChangePayload,
            ),
          }
        : {}),
    };
  }

  /** Live counterparts for every unit a payload carries - read-only (the
   *  decided-set diff renders against these; nothing is compared or pruned). */
  private async collectCurrentValues(
    tourId: string,
    payload: PendingChangePayload,
  ): Promise<PendingChangeCurrentValues> {
    const current: PendingChangeCurrentValues = {};
    if (payload.tour?.name !== undefined) {
      const tour = await this.prisma.tour.findUnique({
        where: { id: tourId },
        select: { name: true },
      });
      current.tour = { name: tour?.name ?? null };
    }
    if (payload.translations) {
      const locales: Record<string, Record<string, unknown>> = {};
      for (const [locale, fields] of Object.entries(payload.translations)) {
        const live = await this.prisma.tourTranslation.findUnique({
          where: {
            tourId_locale: { tourId, locale: locale as any },
          },
        });
        const kept: Record<string, unknown> = {};
        for (const key of Object.keys(fields)) {
          kept[key] = (live as Record<string, unknown> | null)?.[key] ?? null;
        }
        locales[locale] = kept;
      }
      current.translations = locales;
    }
    if (payload.images) {
      current.images = await this.prisma.tourImage.findMany({
        where: { tourId },
        select: {
          id: true,
          url: true,
          isHero: true,
          focalX: true,
          focalY: true,
          altText: true,
          displayOrder: true,
          width: true,
          height: true,
        },
        orderBy: { displayOrder: 'asc' },
      });
    }
    if (payload.lists) {
      const lists: PendingChangeCurrentValues['lists'] = {};
      for (const kindKey of Object.keys(payload.lists)) {
        const kind = kindKey as StagedListKind;
        lists[kind] = await this.loadRealList(tourId, kind);
      }
      current.lists = lists;
    }
    if (payload.conditions) {
      current.conditions = await this.loadLiveConditions(tourId);
    }
    return current;
  }

  /** The live operator-conditions gate, in the staged unit's own shape. The
   *  document half lives on the OPERATOR row (one per operator). */
  async loadLiveConditions(tourId: string): Promise<StagedConditions> {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: {
        operatorTermsKind: true,
        acknowledgmentItems: true,
        operator: { select: { termsDocument: true } },
      },
    });
    return {
      kind: tour?.operatorTermsKind ?? null,
      acknowledgmentItems:
        (tour?.acknowledgmentItems as Record<string, string[]> | null) ?? null,
      document:
        tour?.operatorTermsKind === OperatorTermsKind.DOCUMENT
          ? ((tour?.operator?.termsDocument as Record<string, string> | null) ??
            null)
          : null,
    };
  }

  /**
   * Drop every stashed value that EQUALS its live counterpart, persist the
   * healed payload when anything fell away, and delete the set outright when
   * nothing survives. Same comparison rules as stash time ('' and undefined
   * read as null, arrays element-wise). Returns the (possibly healed) row
   * plus the LIVE counterparts of every kept field - the diff both roles
   * render against.
   */
  private async pruneOpenAgainstLive(row: PendingChangeRow): Promise<{
    row: PendingChangeRow;
    current: PendingChangeCurrentValues;
  } | null> {
    const payload = row.payload as PendingChangePayload;
    const next: PendingChangePayload = {};
    const current: PendingChangeCurrentValues = {};
    let pruned = false;
    const norm = (v: unknown) =>
      v === '' || v === undefined || v === null ? null : v;

    if (payload.tour?.name !== undefined) {
      const tour = await this.prisma.tour.findUnique({
        where: { id: row.tourId },
        select: { name: true },
      });
      if (tour && tour.name === payload.tour.name) pruned = true;
      else {
        next.tour = payload.tour;
        current.tour = { name: tour?.name ?? null };
      }
    }

    if (payload.translations) {
      const keptLocales: Record<string, Record<string, unknown>> = {};
      const currentLocales: Record<string, Record<string, unknown>> = {};
      for (const [locale, fields] of Object.entries(payload.translations)) {
        const live = await this.prisma.tourTranslation.findUnique({
          where: {
            tourId_locale: { tourId: row.tourId, locale: locale as any },
          },
        });
        const kept: Record<string, unknown> = {};
        const liveKept: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          const liveVal = (live as Record<string, unknown> | null)?.[key];
          const same = Array.isArray(value)
            ? JSON.stringify(value) === JSON.stringify(liveVal ?? [])
            : norm(value) === norm(liveVal);
          if (same) pruned = true;
          else {
            kept[key] = value;
            liveKept[key] = liveVal ?? null;
          }
        }
        if (Object.keys(kept).length > 0) {
          keptLocales[locale] = kept;
          currentLocales[locale] = liveKept;
        }
      }
      if (Object.keys(keptLocales).length > 0) {
        next.translations = keptLocales;
        current.translations = currentLocales;
      }
    }

    if (payload.images) {
      const real = await this.prisma.tourImage.findMany({
        where: { tourId: row.tourId },
        select: {
          id: true,
          url: true,
          isHero: true,
          focalX: true,
          focalY: true,
          altText: true,
          displayOrder: true,
          width: true,
          height: true,
        },
        orderBy: { displayOrder: 'asc' },
      });
      if (this.stageEqualsGallery(payload.images, real)) pruned = true;
      else {
        next.images = payload.images;
        current.images = real;
      }
    }

    if (payload.lists) {
      const keptLists: PendingChangePayload['lists'] = {};
      const currentLists: PendingChangeCurrentValues['lists'] = {};
      for (const [kindKey, staged] of Object.entries(payload.lists)) {
        const kind = kindKey as StagedListKind;
        if (!staged) continue;
        const real = await this.loadRealList(row.tourId, kind);
        if (this.listEquals(kind, staged, real)) pruned = true;
        else {
          keptLists[kind] = staged;
          currentLists[kind] = real;
        }
      }
      if (Object.keys(keptLists).length > 0) {
        next.lists = keptLists;
        current.lists = currentLists;
      }
    }

    if (payload.conditions) {
      const live = await this.loadLiveConditions(row.tourId);
      if (this.conditionsEqual(payload.conditions, live)) pruned = true;
      else {
        next.conditions = payload.conditions;
        current.conditions = live;
      }
    }

    // Per-unit timestamps survive only for units that survived the prune.
    if (payload.meta?.fieldTimes) {
      const kept: Record<string, string> = {};
      for (const [key, at] of Object.entries(payload.meta.fieldTimes)) {
        const alive =
          key === 'title'
            ? next.tour !== undefined
            : key === 'photos'
              ? next.images !== undefined
              : key === 'conditions'
                ? next.conditions !== undefined
                : key.startsWith('list:')
                  ? next.lists?.[key.slice(5) as StagedListKind] !== undefined
                  : key.startsWith('tr:')
                    ? (() => {
                        const [, locale, field] = key.split(':');
                        return (
                          next.translations?.[locale]?.[field] !== undefined
                        );
                      })()
                    : false;
        if (alive) kept[key] = at;
      }
      if (Object.keys(kept).length > 0) next.meta = { fieldTimes: kept };
    }

    if (!pruned) return { row, current };
    // Optimistic guard on the write-on-read (code review): a stash landing
    // between this prune's read and its write must never be clobbered by the
    // stale heal - `updatedAt` is the version stamp, and a miss just serves
    // this read unpruned (the next read re-prunes the fresh payload).
    if (this.isEmptyPayload(next)) {
      const gone = await this.prisma.tourPendingChange.deleteMany({
        where: { id: row.id, updatedAt: row.updatedAt },
      });
      if (gone.count === 0) return { row, current };
      this.logger.log(
        `Pending change set ${row.id} pruned to nothing on read - withdrawn`,
      );
      return null;
    }
    const healed = await this.prisma.tourPendingChange.updateMany({
      where: { id: row.id, updatedAt: row.updatedAt },
      data: { payload: next as Prisma.InputJsonValue },
    });
    if (healed.count === 0) return { row, current };
    this.logger.log(
      `Pending change set ${row.id} pruned against live content on read`,
    );
    return { row: { ...row, payload: next as Prisma.JsonValue }, current };
  }

  /** True when the payload proposes nothing - such a set is withdrawn. */
  private isEmptyPayload(p: PendingChangePayload): boolean {
    return (
      p.tour?.name === undefined &&
      (!p.translations || Object.keys(p.translations).length === 0) &&
      !p.images &&
      !p.conditions &&
      !this.hasAnyList(p)
    );
  }

  /**
   * Apply `mutate` to the tour's open change set and persist the result:
   * create-and-notify when none is open, update in place - or DELETE the set
   * outright when the payload emptied, because reverting every proposed
   * change is withdrawing the review request (UX round 2: a stale "waiting
   * for review" banner over nothing is worse than none).
   *
   * The mutator runs against the FRESHEST open payload, including on the
   * P2002 create race (the partial unique index keeps one row; the loser
   * re-applies its mutation onto the winner).
   */
  private async mutateStash(
    tour: { id: string; operatorId: string; name: string },
    submittedById: string,
    mutate: (current: PendingChangePayload) => PendingChangePayload,
  ) {
    const open = await this.getOpenForTour(tour.id);
    // No open set: seed from the tour's rejected draft, if that is its last
    // word. Fixing the one flagged key must revive the WHOLE proposal, not
    // start a fresh one that silently drops every other held edit (client
    // round 6). The rejected row itself stays untouched - it is history.
    const rejectedBase = open ? null : await this.getWorkingSetForTour(tour.id);
    const next = mutate(
      ((open ?? rejectedBase)?.payload as PendingChangePayload) ?? {},
    );
    if (this.isEmptyPayload(next)) {
      if (open) {
        await this.prisma.tourPendingChange.delete({ where: { id: open.id } });
        this.logger.log(
          `Pending change set ${open.id} on tour ${tour.id} withdrawn - every proposed change was reverted`,
        );
      }
      return null;
    }
    if (open) {
      return this.prisma.tourPendingChange.update({
        where: { id: open.id },
        data: { payload: next as Prisma.InputJsonValue },
        select: pendingChangeSelect,
      });
    }
    let raced = false;
    const created = await this.prisma.tourPendingChange
      .create({
        data: {
          tourId: tour.id,
          payload: next as Prisma.InputJsonValue,
          submittedById,
        },
        select: pendingChangeSelect,
      })
      .catch(async (err: any) => {
        if (err?.code !== 'P2002') throw err;
        raced = true;
        const winner = await this.getOpenForTour(tour.id);
        if (!winner) throw err;
        return this.prisma.tourPendingChange.update({
          where: { id: winner.id },
          data: {
            payload: mutate(
              winner.payload as PendingChangePayload,
            ) as Prisma.InputJsonValue,
          },
          select: pendingChangeSelect,
        });
      });
    // Notify only on a genuine open - the race loser folded into a set the
    // winner already announced.
    if (created && !raced) {
      this.inbox.notify({
        event: InboxEvent.TOUR_SUBMITTED_FOR_REVIEW,
        operatorId: tour.operatorId,
        title: rejectedBase
          ? `${tour.name}: content changes updated after review`
          : `${tour.name}: content changes need review`,
        body: 'Edits to a live tour wait for approval - travellers keep seeing the current version meanwhile.',
        url: this.tourReviewPath(tour.id),
        entityType: 'tour',
        entityId: tour.id,
        actorUserId: submittedById,
        dedupeKey: `tour-content-changes:${tour.id}:${created.id}`,
      });
      this.logger.log(
        `User ${submittedById} opened a pending change set for live tour ${tour.id}`,
      );
    }
    return created;
  }

  /** Propose (or, with null, withdraw) a held title. */
  async setStashedName(
    tour: { id: string; operatorId: string; name: string },
    submittedById: string,
    name: string | null,
  ) {
    return this.mutateStash(tour, submittedById, (current) => {
      const { tour: _tour, meta, ...rest } = current;
      const nextMeta = withFieldTime(meta, 'title', name !== null);
      return {
        ...rest,
        ...(nextMeta ? { meta: nextMeta } : {}),
        ...(name === null ? {} : { tour: { name } }),
      };
    });
  }

  /** Stage (or, with null, withdraw) the operator-conditions gate change
   *  (Pastel #80) - the staged value is the WHOLE desired state. */
  async setStagedConditions(
    tour: { id: string; operatorId: string; name: string },
    submittedById: string,
    staged: StagedConditions | null,
  ) {
    let toStore = staged;
    if (staged?.kind === OperatorTermsKind.DOCUMENT) {
      // Snapshot the OPERATOR row's document (not loadLiveConditions, whose
      // document is null while the live kind is still ACKNOWLEDGMENT/None) -
      // approve() CAS-checks the write against this.
      const op = await this.prisma.operator.findUnique({
        where: { id: tour.operatorId },
        select: { termsDocument: true },
      });
      toStore = {
        ...staged,
        documentBase:
          (op?.termsDocument as Record<string, string> | null) ?? null,
      };
    }
    return this.mutateStash(tour, submittedById, (current) => {
      const { conditions: _conditions, meta, ...rest } = current;
      const nextMeta = withFieldTime(meta, 'conditions', toStore !== null);
      return {
        ...rest,
        ...(nextMeta ? { meta: nextMeta } : {}),
        ...(toStore === null ? {} : { conditions: toStore }),
      };
    });
  }

  /** Same comparison at stash, prune and withdraw time: the gate change is
   *  one unit - kind plus the full items and document maps. */
  conditionsEqual(a: StagedConditions, b: StagedConditions): boolean {
    return (
      (a.kind ?? null) === (b.kind ?? null) &&
      JSON.stringify(a.acknowledgmentItems ?? null) ===
        JSON.stringify(b.acknowledgmentItems ?? null) &&
      JSON.stringify(a.document ?? null) === JSON.stringify(b.document ?? null)
    );
  }

  /**
   * Set one locale's stashed translation fields. `changed` holds fields whose
   * proposed value differs from the live row; `revertedKeys` are fields this
   * request defined that now EQUAL the live row - they leave the stash, so
   * editing a field back to its live value cancels that part of the review.
   * Keys the request did not define stay stashed (the copy form and the SEO
   * form write disjoint halves of the same locale).
   */
  async setTranslationStash(
    tour: { id: string; operatorId: string; name: string },
    submittedById: string,
    locale: string,
    changed: Record<string, unknown>,
    revertedKeys: string[] = [],
  ) {
    return this.mutateStash(tour, submittedById, (current) => {
      const entry = { ...current.translations?.[locale] };
      for (const key of revertedKeys) delete entry[key];
      Object.assign(entry, changed);
      const translations = { ...current.translations };
      if (Object.keys(entry).length === 0) delete translations[locale];
      else translations[locale] = entry;
      const { translations: _t, meta, ...rest } = current;
      let nextMeta = meta;
      for (const key of revertedKeys)
        nextMeta = withFieldTime(nextMeta, `tr:${locale}:${key}`, false);
      for (const key of Object.keys(changed))
        nextMeta = withFieldTime(nextMeta, `tr:${locale}:${key}`, true);
      return {
        ...rest,
        ...(nextMeta ? { meta: nextMeta } : {}),
        ...(Object.keys(translations).length === 0 ? {} : { translations }),
      };
    });
  }

  /** Replace (or, with null, withdraw) the staged gallery. */
  private async setStagedImages(
    tour: { id: string; operatorId: string; name: string },
    submittedById: string,
    images: StagedImage[] | null,
  ) {
    return this.mutateStash(tour, submittedById, (current) => {
      const { images: _images, meta, ...rest } = current;
      const nextMeta = withFieldTime(meta, 'photos', images !== null);
      return {
        ...rest,
        ...(nextMeta ? { meta: nextMeta } : {}),
        ...(images === null ? {} : { images }),
      };
    });
  }

  /** True when the staged list matches the real gallery exactly - the photo
   *  changes were all reverted and the stage can be withdrawn. */
  private async stageEqualsReal(
    tourId: string,
    staged: StagedImage[],
  ): Promise<boolean> {
    if (staged.some((i) => i.isNew)) return false;
    const real = await this.prisma.tourImage.findMany({
      where: { tourId },
      select: {
        id: true,
        url: true,
        isHero: true,
        focalX: true,
        focalY: true,
        altText: true,
        displayOrder: true,
        width: true,
        height: true,
      },
    });
    return this.stageEqualsGallery(staged, real);
  }

  /** The pure comparison behind stageEqualsReal - callers that already hold
   *  the real gallery (the read-time prune) reuse it without re-querying. */
  private stageEqualsGallery(
    staged: StagedImage[],
    real: Omit<StagedImage, 'isNew'>[],
  ): boolean {
    if (staged.some((i) => i.isNew)) return false;
    if (real.length !== staged.length) return false;
    const byId = new Map(staged.map((i) => [i.id, i]));
    return real.every((r) => {
      const s = byId.get(r.id);
      return (
        !!s &&
        s.url === r.url &&
        s.isHero === r.isHero &&
        s.focalX === r.focalX &&
        s.focalY === r.focalY &&
        (s.altText ?? null) === (r.altText ?? null) &&
        s.displayOrder === r.displayOrder
      );
    });
  }

  // ── Staged gallery ────────────────────────────────────────────────────────────

  /** The staged gallery for a tour's open change set, or null. */
  async getStagedImages(tourId: string): Promise<StagedImage[] | null> {
    const working = await this.getWorkingSetForTour(tourId);
    const payload = working?.payload as PendingChangePayload | undefined;
    return payload?.images ?? null;
  }

  /**
   * The list a gated image op starts from: the already-staged gallery, else
   * a fresh copy of the real one.
   */
  private async stagingBase(tourId: string): Promise<StagedImage[]> {
    const staged = await this.getStagedImages(tourId);
    if (staged) return staged;
    const real = await this.prisma.tourImage.findMany({
      where: { tourId },
      select: {
        id: true,
        url: true,
        isHero: true,
        focalX: true,
        focalY: true,
        altText: true,
        displayOrder: true,
        width: true,
        height: true,
      },
      orderBy: { displayOrder: 'asc' },
    });
    return real.map((img) => ({ ...img }));
  }

  async stageImageAdd(
    tour: { id: string; operatorId: string; name: string },
    dto: {
      url: string;
      isHero?: boolean;
      focalX?: number;
      focalY?: number;
      altText?: string | null;
      displayOrder?: number;
      width: number;
      height: number;
    },
    submittedById: string,
  ) {
    const base = await this.stagingBase(tour.id);
    if (base.length >= MAX_STAGED_IMAGES) {
      throw new BadRequestException(
        `A tour gallery holds at most ${MAX_STAGED_IMAGES} photos - remove one before adding another`,
      );
    }
    const entry: StagedImage = {
      id: randomUUID(),
      url: dto.url,
      isHero: dto.isHero ?? false,
      focalX: dto.focalX ?? 0.5,
      focalY: dto.focalY ?? 0.5,
      altText: dto.altText ?? null,
      displayOrder: dto.displayOrder ?? 0,
      width: dto.width,
      height: dto.height,
      isNew: true,
    };
    const next = entry.isHero
      ? [...base.map((i) => ({ ...i, isHero: false })), entry]
      : [...base, entry];
    // An add always differs from the real gallery - no revert check needed.
    await this.setStagedImages(tour, submittedById, next);
    return this.toImageShape(tour.id, entry);
  }

  async stageImageUpdate(
    tour: { id: string; operatorId: string; name: string },
    imageId: string,
    dto: {
      isHero?: boolean;
      focalX?: number;
      focalY?: number;
      altText?: string | null;
      displayOrder?: number;
    },
    submittedById: string,
  ) {
    const base = await this.stagingBase(tour.id);
    const target = base.find((i) => i.id === imageId);
    if (!target)
      throw new NotFoundException(
        `Image ${imageId} not found on tour ${tour.id}`,
      );
    const next = base.map((i) => {
      if (i.id !== imageId) {
        // Setting a new hero demotes every other entry, like the real op.
        return dto.isHero === true ? { ...i, isHero: false } : i;
      }
      return {
        ...i,
        ...(dto.isHero !== undefined && { isHero: dto.isHero }),
        ...(dto.focalX !== undefined && { focalX: dto.focalX }),
        ...(dto.focalY !== undefined && { focalY: dto.focalY }),
        ...(dto.altText !== undefined && { altText: dto.altText }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
      };
    });
    await this.setStagedImages(
      tour,
      submittedById,
      (await this.stageEqualsReal(tour.id, next)) ? null : next,
    );
    const updated = next.find((i) => i.id === imageId)!;
    return this.toImageShape(tour.id, updated);
  }

  async stageImageRemove(
    tour: { id: string; operatorId: string; name: string },
    imageId: string,
    submittedById: string,
  ) {
    const base = await this.stagingBase(tour.id);
    if (!base.some((i) => i.id === imageId))
      throw new NotFoundException(
        `Image ${imageId} not found on tour ${tour.id}`,
      );
    const next = base.filter((i) => i.id !== imageId);
    // Removing a just-staged addition can bring the stage back to exactly the
    // real gallery - then the photo review is withdrawn, not kept as noise.
    await this.setStagedImages(
      tour,
      submittedById,
      (await this.stageEqualsReal(tour.id, next)) ? null : next,
    );
  }

  /** Staged entry in the same shape the real image endpoints return. */
  toImageShape(tourId: string, img: StagedImage) {
    const { isNew: _isNew, ...rest } = img;
    return { tourId, ...rest };
  }

  // ── Staged itemized lists (all content child entities) ─────────────────────────

  /** The live rows of `kind`, in the same shape the staged items use. */
  private async loadRealList(
    tourId: string,
    kind: StagedListKind,
  ): Promise<StagedListItem[]> {
    const cfg = LIST_CONFIG[kind];
    const select: Record<string, unknown> = { id: true };
    for (const f of cfg.baseFields) select[f] = true;
    const trSelect: Record<string, unknown> = {
      locale: true,
      isMachineTranslated: true,
    };
    for (const f of cfg.trFields) trSelect[f] = true;
    select.translations = { select: trSelect };
    const delegate = (
      this.prisma as unknown as Record<
        string,
        { findMany: (args: unknown) => Promise<StagedListItem[]> }
      >
    )[cfg.delegate];
    return delegate.findMany({
      where: { tourId },
      select,
      orderBy: { displayOrder: 'asc' },
    });
  }

  /** The staged list for `kind` in the open set, or null. */
  async getStagedList(
    tourId: string,
    kind: StagedListKind,
  ): Promise<StagedListItem[] | null> {
    const working = await this.getWorkingSetForTour(tourId);
    return (
      (working?.payload as PendingChangePayload | undefined)?.lists?.[kind] ??
      null
    );
  }

  private async stagedListBase(
    tourId: string,
    kind: StagedListKind,
  ): Promise<StagedListItem[]> {
    return (
      (await this.getStagedList(tourId, kind)) ??
      (await this.loadRealList(tourId, kind))
    );
  }

  /** The EN text of a staged item - the canonical value the diff renders. */
  static enTextOf(item: Pick<StagedListItem, 'translations'>): string {
    const en = item.translations.find((t) => t.locale === 'en');
    if (!en) return '';
    const value = en.text ?? en.label ?? en.title;
    return typeof value === 'string' ? value : '';
  }

  /** Replace (or withdraw with null) one kind's staged list. */
  private async setStagedList(
    tour: { id: string; operatorId: string; name: string },
    submittedById: string,
    kind: StagedListKind,
    items: StagedListItem[] | null,
  ) {
    return this.mutateStash(tour, submittedById, (current) => {
      const lists = { ...current.lists };
      if (items === null) delete lists[kind];
      else lists[kind] = items;
      const { lists: _lists, meta, ...rest } = current;
      const nextMeta = withFieldTime(meta, `list:${kind}`, items !== null);
      return {
        ...rest,
        ...(nextMeta ? { meta: nextMeta } : {}),
        ...(Object.keys(lists).length === 0 ? {} : { lists }),
      };
    });
  }

  /** True when the staged list matches the live rows exactly - the list
   *  edits were all reverted and that lane of the stage can be withdrawn.
   *  Compares every base field AND every translation locale/field. */
  private listEquals(
    kind: StagedListKind,
    staged: StagedListItem[],
    real: StagedListItem[],
  ): boolean {
    if (staged.some((i) => i.isNew)) return false;
    if (staged.length !== real.length) return false;
    const cfg = LIST_CONFIG[kind];
    const norm = (v: unknown) => (v === undefined || v === '' ? null : v);
    const byId = new Map(staged.map((i) => [i.id, i]));
    return real.every((r) => {
      const s = byId.get(r.id);
      if (!s) return false;
      for (const f of cfg.baseFields) {
        const a = s[f];
        const b = r[f];
        if (Array.isArray(a) || Array.isArray(b)) {
          if (JSON.stringify(a ?? []) !== JSON.stringify(b ?? [])) return false;
        } else if (norm(a) !== norm(b)) return false;
      }
      if (s.translations.length !== r.translations.length) return false;
      const trByLocale = new Map(s.translations.map((t) => [t.locale, t]));
      return r.translations.every((rt) => {
        const st = trByLocale.get(rt.locale);
        if (!st) return false;
        return cfg.trFields.every((f) => norm(st[f]) === norm(rt[f]));
      });
    });
  }

  /**
   * Stage a new list item. `base` holds row columns, `tr` the EN translation
   * fields (every add path writes EN - the canonical language).
   */
  async stageListAdd(
    tour: { id: string; operatorId: string; name: string },
    kind: StagedListKind,
    base: Record<string, unknown>,
    tr: Record<string, unknown>,
    submittedById: string,
  ) {
    const cfg = LIST_CONFIG[kind];
    const staged = await this.stagedListBase(tour.id, kind);
    if (staged.length >= MAX_STAGED_LIST_ITEMS) {
      throw new BadRequestException(
        `A list holds at most ${MAX_STAGED_LIST_ITEMS} items - remove one before adding another`,
      );
    }
    const entry: StagedListItem = {
      id: randomUUID(),
      ...pickKeys(base, cfg.baseFields),
      translations: [
        {
          locale: 'en',
          ...pickKeys(tr, cfg.trFields),
          isMachineTranslated: false,
        },
      ],
      isNew: true,
    };
    await this.setStagedList(tour, submittedById, kind, [...staged, entry]);
    return this.toListItemShape(tour.id, entry);
  }

  /**
   * Stage an update to a list item: row columns via `base`, one locale's
   * translation fields via `tr` (ANY locale - per-item translation edits on
   * a live tour are held like everything else).
   */
  async stageListUpdate(
    tour: { id: string; operatorId: string; name: string },
    kind: StagedListKind,
    itemId: string,
    base: Record<string, unknown>,
    tr: { locale: string; fields: Record<string, unknown> } | null,
    submittedById: string,
  ) {
    const cfg = LIST_CONFIG[kind];
    const staged = await this.stagedListBase(tour.id, kind);
    const target = staged.find((i) => i.id === itemId);
    if (!target)
      throw new NotFoundException(
        `Item ${itemId} not found on tour ${tour.id}`,
      );
    // A tr patch with no defined translatable field is a no-op, not an
    // empty overwrite (the universal update hook passes the whole dto).
    const trPatch =
      tr && Object.keys(pickKeys(tr.fields, cfg.trFields)).length > 0
        ? tr
        : null;
    const next = staged.map((i) => {
      if (i.id !== itemId) return i;
      const updated: StagedListItem = {
        ...i,
        ...pickKeys(base, cfg.baseFields),
      };
      if (trPatch) {
        const existing = i.translations.find(
          (t) => t.locale === trPatch.locale,
        );
        const entry: StagedItemTranslation = {
          ...(existing ?? { locale: trPatch.locale }),
          ...pickKeys(trPatch.fields, cfg.trFields),
          isMachineTranslated: false,
        };
        updated.translations = [
          entry,
          ...i.translations.filter((t) => t.locale !== trPatch.locale),
        ];
      }
      return updated;
    });
    const real = await this.loadRealList(tour.id, kind);
    await this.setStagedList(
      tour,
      submittedById,
      kind,
      this.listEquals(kind, next, real) ? null : next,
    );
    return this.toListItemShape(tour.id, next.find((i) => i.id === itemId)!);
  }

  async stageListRemove(
    tour: { id: string; operatorId: string; name: string },
    kind: StagedListKind,
    itemId: string,
    submittedById: string,
  ) {
    const staged = await this.stagedListBase(tour.id, kind);
    if (!staged.some((i) => i.id === itemId))
      throw new NotFoundException(
        `Item ${itemId} not found on tour ${tour.id}`,
      );
    const next = staged.filter((i) => i.id !== itemId);
    const real = await this.loadRealList(tour.id, kind);
    await this.setStagedList(
      tour,
      submittedById,
      kind,
      this.listEquals(kind, next, real) ? null : next,
    );
  }

  /** Staged item in the same shape the real list endpoints return. */
  toListItemShape(
    tourId: string,
    item: StagedListItem,
  ): StagedListItem & { tourId: string } {
    const { isNew: _isNew, ...rest } = item;
    return { tourId, ...rest };
  }

  // ── Admin queue + decisions ───────────────────────────────────────────────────

  /** Open change sets FIFO (oldest submission first) for the review queue. */
  async listOpen(page = 1, limit = 20) {
    const where = { status: PendingChangeStatus.PENDING };
    const [total, rows] = await Promise.all([
      this.prisma.tourPendingChange.count({ where }),
      this.prisma.tourPendingChange.findMany({
        where,
        orderBy: { submittedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          ...pendingChangeSelect,
          tour: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              destination: { select: { id: true, name: true, slug: true } },
              operator: {
                select: {
                  id: true,
                  companyInfo: { select: { companyName: true } },
                  user: { select: { name: true, email: true } },
                },
              },
              images: {
                where: { isHero: true },
                select: { url: true },
                take: 1,
              },
            },
          },
        },
      }),
    ]);
    return {
      total,
      page,
      limit,
      data: rows.map((row) => ({
        ...row,
        changedAreas: this.changedAreas(row.payload as PendingChangePayload),
      })),
    };
  }

  /**
   * The operator Submissions view's content lane: each of the operator's
   * tours' LATEST change set - open ones and sent-back ones, so "changes
   * requested" is visible without opening every tour. Applied history stays
   * out: once approved there is nothing in flight. Oldest submission first,
   * like the admin queue.
   */
  async listForOperator(operatorId: string, page = 1, limit = 20) {
    const rows = await this.prisma.tourPendingChange.findMany({
      // Approved history is filtered in the QUERY, not in memory - decided
      // rows persist forever, and enough of them would push a genuinely
      // open set on an older tour out of the take window (code review).
      where: {
        tour: { operatorId },
        status: { not: PendingChangeStatus.APPROVED },
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      // An operator's catalogue is dozens of tours at most - the in-memory
      // latest-per-tour pass is bounded by this take.
      take: 500,
      select: {
        ...pendingChangeSelect,
        tour: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            destination: { select: { id: true, name: true, slug: true } },
            images: {
              where: { isHero: true },
              select: { url: true },
              take: 1,
            },
          },
        },
      },
    });
    const latestPerTour = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestPerTour.has(row.tourId)) latestPerTour.set(row.tourId, row);
    }
    // A REJECTED set is only "in flight" while it is the tour's LAST word:
    // once a resubmission was approved, the old rejection is history - and
    // since approved rows are filtered out of the query above, that history
    // has to be checked separately or it would resurface here.
    const rejectedTourIds = [...latestPerTour.values()]
      .filter((row) => row.status === PendingChangeStatus.REJECTED)
      .map((row) => row.tourId);
    const supersededBy = new Map<string, Date>();
    if (rejectedTourIds.length > 0) {
      const approved = await this.prisma.tourPendingChange.groupBy({
        by: ['tourId'],
        where: {
          tourId: { in: rejectedTourIds },
          status: PendingChangeStatus.APPROVED,
        },
        _max: { submittedAt: true },
      });
      for (const a of approved) {
        if (a._max.submittedAt) supersededBy.set(a.tourId, a._max.submittedAt);
      }
    }
    const inFlight = [...latestPerTour.values()]
      .filter((row) => {
        if (row.status !== PendingChangeStatus.REJECTED) return true;
        const approvedAt = supersededBy.get(row.tourId);
        return !approvedAt || approvedAt < row.submittedAt;
      })
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    return {
      total: inFlight.length,
      page,
      limit,
      data: inFlight
        .slice((page - 1) * limit, (page - 1) * limit + limit)
        .map((row) => ({
          ...row,
          changedAreas: this.changedAreas(row.payload as PendingChangePayload),
        })),
    };
  }

  /**
   * Apply the open change set to the live rows in one transaction. The slug
   * is deliberately untouched: a live address changes only by an explicit
   * admin rename, never as a content-approval side effect.
   */
  async approve(tourId: string, adminId: string, note?: string) {
    const open = await this.getOpenForTour(tourId);
    if (!open)
      throw new NotFoundException(
        `Tour ${tourId} has no pending content changes`,
      );
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { id: true, name: true, operatorId: true },
    });
    if (!tour) throw new NotFoundException(`Tour ${tourId} not found`);
    const payload = open.payload as PendingChangePayload;

    const decided = await this.prisma.$transaction(async (tx) => {
      if (payload.tour?.name !== undefined) {
        await tx.tour.update({
          where: { id: tourId },
          data: { name: payload.tour.name },
        });
      }
      if (payload.conditions) {
        // DOCUMENT must still have a document behind it at APPLY time - the
        // write-time check is the other enforcement point, and the operator's
        // document could have been cleared mid-review. The staged unit may
        // itself CARRY the document (operator-authored via the wizard).
        if (payload.conditions.kind === OperatorTermsKind.DOCUMENT) {
          // The document is ONE row per operator shared by all their tours -
          // lock it so concurrent approvals/instant writes serialize instead
          // of losing each other's merge.
          await tx.$queryRaw`SELECT id FROM operators WHERE id = ${tour.operatorId} FOR UPDATE`;
          const op = await tx.operator.findUnique({
            where: { id: tour.operatorId },
            select: { termsDocument: true, termsVersion: true },
          });
          const stagedEn = payload.conditions.document?.en ?? null;
          if (
            !htmlHasText(stagedEn) &&
            !resolveLocaleText(op?.termsDocument, 'en')
          ) {
            throw new UnprocessableEntityException(
              'The operator has no conditions document on file - the document gate cannot be approved',
            );
          }
          // Apply the staged document to the OPERATOR row (one document per
          // operator - MCK-20 §4). A changed ENGLISH text is a new legal
          // object, so the version stamps to today; translation-only merges
          // keep the version (acceptance evidence names the EN text).
          if (
            payload.conditions.document &&
            JSON.stringify(payload.conditions.document) !==
              JSON.stringify(op?.termsDocument ?? null)
          ) {
            // CAS against the document this proposal was staged on: with two
            // DOCUMENT-flavored tours, approving T1 moves the shared text -
            // blind-applying T2's older proposal would silently revert it.
            // undefined = pre-CAS row, no baseline to check.
            const base = payload.conditions.documentBase;
            if (
              base !== undefined &&
              JSON.stringify(base ?? null) !==
                JSON.stringify(op?.termsDocument ?? null)
            ) {
              throw new ConflictException(
                "The operator's conditions document changed after this proposal was staged - reject it with a note so the operator can restage against the current text",
              );
            }
            const enChanged =
              stagedEn !==
              ((op?.termsDocument as Record<string, string> | null)?.en ??
                null);
            await tx.operator.update({
              where: { id: tour.operatorId },
              data: {
                termsDocument: payload.conditions.document,
                ...(enChanged
                  ? {
                      termsVersion: `v${new Date().toISOString().slice(0, 10)}`,
                      termsEffectiveDate: new Date(),
                    }
                  : {}),
              },
            });
          }
        }
        await tx.tour.update({
          where: { id: tourId },
          data: {
            operatorTermsKind: payload.conditions.kind,
            acknowledgmentItems:
              payload.conditions.kind === OperatorTermsKind.ACKNOWLEDGMENT &&
              payload.conditions.acknowledgmentItems
                ? (payload.conditions
                    .acknowledgmentItems as Prisma.InputJsonValue)
                : Prisma.DbNull,
          },
        });
      }
      for (const [locale, fields] of Object.entries(
        payload.translations ?? {},
      )) {
        // Re-whitelist at APPLY time too - the stash-time whitelist is the
        // other enforcement point, and trusting stored JSON alone would let
        // the two drift (security review #80).
        const safeFields: Record<string, unknown> = {};
        for (const key of TRANSLATION_CONTENT_KEYS) {
          if (key in fields) safeFields[key] = fields[key];
        }
        await tx.tourTranslation.upsert({
          where: { tourId_locale: { tourId, locale: locale as any } },
          create: {
            tourId,
            locale: locale as any,
            ...safeFields,
            isMachineTranslated: false,
          },
          update: { ...safeFields, isMachineTranslated: false },
        });
      }
      if (payload.images) {
        const keptIds = payload.images.filter((i) => !i.isNew).map((i) => i.id);
        await tx.tourImage.deleteMany({
          where: { tourId, id: { notIn: keptIds } },
        });
        for (const img of payload.images) {
          const data = {
            url: img.url,
            isHero: img.isHero,
            focalX: img.focalX,
            focalY: img.focalY,
            altText: img.altText,
            displayOrder: img.displayOrder,
            width: img.width,
            height: img.height,
          };
          if (img.isNew) {
            await tx.tourImage.create({
              data: { id: img.id, tourId, ...data },
            });
          } else {
            // updateMany, tourId-scoped: a staged id can never touch another
            // tour's row (security review #80), and a staged reference whose
            // real image an admin deleted mid-review updates 0 rows - the
            // photo just stays gone - instead of throwing P2025 and bricking
            // the whole approval (code-review #80 finding 3).
            await tx.tourImage.updateMany({
              where: { id: img.id, tourId },
              data,
            });
          }
        }
      }
      for (const [kindKey, staged] of Object.entries(payload.lists ?? {})) {
        const kind = kindKey as StagedListKind;
        const cfg = LIST_CONFIG[kind];
        if (!staged) continue;
        const delegate = (tx as unknown as Record<string, any>)[cfg.delegate];
        const trDelegate = (tx as unknown as Record<string, any>)[
          cfg.trDelegate
        ];
        // The staged list is the WHOLE desired state, so most translation
        // entries are verbatim copies of live rows. Rewriting those would
        // null their sourceHash and force the AI pipeline to re-translate
        // every untouched locale of every item on the next enqueue - wasted
        // provider calls, and non-deterministic output means untouched
        // wording could drift on an unrelated approval (final review).
        const liveByItem = new Map(
          (await this.loadRealList(tourId, kind)).map((item) => [
            item.id,
            new Map(item.translations.map((t) => [t.locale, t])),
          ]),
        );
        const trUnchanged = (
          itemId: string,
          t: StagedItemTranslation,
        ): boolean => {
          const live = liveByItem.get(itemId)?.get(t.locale);
          if (!live) return false;
          return (
            cfg.trFields.every((f) => (t[f] ?? null) === (live[f] ?? null)) &&
            (t.isMachineTranslated ?? false) ===
              (live.isMachineTranslated ?? false)
          );
        };
        const keptIds = staged.filter((i) => !i.isNew).map((i) => i.id);
        // tourId-scoped like the gallery: a staged id can never touch
        // another tour's rows, and a stale reference updates 0 rows.
        await delegate.deleteMany({
          where: { tourId, id: { notIn: keptIds } },
        });
        for (const item of staged) {
          const base = pickKeys(item, cfg.baseFields);
          if (item.isNew) {
            await delegate.create({ data: { id: item.id, tourId, ...base } });
          } else {
            await delegate.updateMany({
              where: { id: item.id, tourId },
              data: base,
            });
          }
          const stagedLocales = item.translations.map((t) => t.locale);
          await trDelegate.deleteMany({
            where: {
              [cfg.trFk]: item.id,
              locale: { notIn: stagedLocales },
            },
          });
          for (const t of item.translations) {
            if (!item.isNew && trUnchanged(item.id, t)) continue;
            const fields = pickKeys(t, cfg.trFields);
            await trDelegate.upsert({
              where: {
                [`${cfg.trFk}_locale`]: {
                  [cfg.trFk]: item.id,
                  locale: t.locale,
                },
              },
              create: {
                [cfg.trFk]: item.id,
                locale: t.locale,
                ...fields,
                isMachineTranslated: t.isMachineTranslated ?? false,
              },
              // The staged entry's OWN flag, in BOTH branches (code review
              // CRITICAL): a human-edited locale stages false and must stay
              // false or the AI refresh this approval enqueues overwrites the
              // just-approved edit; an untouched machine locale (copied into
              // the stage verbatim) keeps true so the AI may refresh it.
              update: {
                ...fields,
                isMachineTranslated: t.isMachineTranslated ?? false,
                sourceHash: null,
              },
            });
          }
        }
      }
      return tx.tourPendingChange.update({
        where: { id: open.id },
        data: {
          status: PendingChangeStatus.APPROVED,
          decidedAt: new Date(),
          decidedById: adminId,
          reviewNote: note?.trim() || null,
        },
        select: pendingChangeSelect,
      });
    });

    this.logger.log(
      `Admin ${adminId} approved content changes ${open.id} on tour ${tourId}`,
    );
    // An applied EN edit re-sources the other six locales, exactly like the
    // direct (ungated) upsertTranslation path does - without this the
    // machine translations keep the pre-edit copy forever (code-review #80
    // finding 5). List items carry EN too, so any applied list re-sources.
    if (
      (payload.translations && 'en' in payload.translations) ||
      this.hasAnyList(payload)
    ) {
      this.contentTranslation.enqueue('tour', tourId);
    }
    this.inbox.notify({
      event: InboxEvent.TOUR_APPROVED,
      operatorId: tour.operatorId,
      title: `${tour.name}: content changes are live`,
      body: note?.trim()
        ? `Approved with a note: ${note.trim()}`
        : 'Your title, description or photo changes were approved and travellers now see them.',
      url: this.tourReviewPath(tourId),
      entityType: 'tour',
      entityId: tourId,
      actorUserId: adminId,
      dedupeKey: `tour-content-approved:${tourId}:${open.id}`,
    });
    return {
      ...decided,
      changedAreas: this.changedAreas(payload),
    };
  }

  /** Reject the open set - live content stays untouched, note is required. */
  async reject(tourId: string, adminId: string, note: string) {
    const open = await this.getOpenForTour(tourId);
    if (!open)
      throw new NotFoundException(
        `Tour ${tourId} has no pending content changes`,
      );
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { id: true, name: true, operatorId: true },
    });
    if (!tour) throw new NotFoundException(`Tour ${tourId} not found`);
    const decided = await this.prisma.tourPendingChange.update({
      where: { id: open.id },
      data: {
        status: PendingChangeStatus.REJECTED,
        decidedAt: new Date(),
        decidedById: adminId,
        reviewNote: note.trim(),
      },
      select: pendingChangeSelect,
    });
    this.logger.log(
      `Admin ${adminId} rejected content changes ${open.id} on tour ${tourId}`,
    );
    this.inbox.notify({
      event: InboxEvent.TOUR_CHANGES_REQUESTED,
      operatorId: tour.operatorId,
      title: `${tour.name}: content changes were sent back`,
      body: note.trim(),
      url: this.tourReviewPath(tourId),
      entityType: 'tour',
      entityId: tourId,
      actorUserId: adminId,
      dedupeKey: `tour-content-rejected:${tourId}:${open.id}`,
    });
    return {
      ...decided,
      changedAreas: this.changedAreas(open.payload as PendingChangePayload),
    };
  }

  private tourReviewPath(tourId: string): string {
    return `/trips/${tourId}/edit?step=review`;
  }
}
