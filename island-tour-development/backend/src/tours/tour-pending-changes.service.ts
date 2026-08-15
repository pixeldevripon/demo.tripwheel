import { isPlatformWideRole } from '@/common/utils/operator.util';
import { PrismaService } from '@/prisma/prisma.service';
import { InboxService } from '@/inbox/inbox.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InboxEvent,
  PendingChangeStatus,
  Prisma,
  Role,
  TourStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';

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

export interface PendingChangePayload {
  tour?: { name?: string };
  /** Per-locale UpsertTourTranslationDto fields (defined fields only). */
  translations?: Record<string, Record<string, unknown>>;
  /** The STAGED COPY of the whole gallery, when photos were touched. */
  images?: StagedImage[];
}

/** The areas a change set touches - drives the queue's "what changed" chips. */
export type ChangedArea = 'title' | 'content' | 'photos';

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
    return areas;
  }

  /** The open (PENDING) change set for a tour, or null. */
  async getOpenForTour(tourId: string) {
    return this.prisma.tourPendingChange.findFirst({
      where: { tourId, status: PendingChangeStatus.PENDING },
      select: pendingChangeSelect,
    });
  }

  /**
   * The latest change set regardless of status - the operator's wizard shows
   * an open set as "waiting for review" and a decided one as its verdict.
   * The OPEN set wins outright when one exists (the partial unique index
   * guarantees at most one), which also sidesteps same-millisecond
   * submittedAt ties between a rejected set and its fast resubmission
   * (code-review #80 finding 4); the decided fallback tiebreaks on id.
   */
  async getLatestForTour(tourId: string) {
    const row =
      (await this.getOpenForTour(tourId)) ??
      (await this.prisma.tourPendingChange.findFirst({
        where: { tourId },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        select: pendingChangeSelect,
      }));
    if (!row) return null;
    return {
      ...row,
      changedAreas: this.changedAreas(row.payload as PendingChangePayload),
    };
  }

  /**
   * Merge a patch into the tour's open change set, creating it if none is
   * open. Merging (rather than one row per edit) keeps ONE reviewable unit
   * per tour; the platform is notified once per opened set, not per edit.
   */
  async stash(
    tour: { id: string; operatorId: string; name: string },
    submittedById: string,
    patch: PendingChangePayload,
  ) {
    const open = await this.getOpenForTour(tour.id);
    if (!open) {
      const created = await this.prisma.tourPendingChange
        .create({
          data: {
            tourId: tour.id,
            payload: patch as Prisma.InputJsonValue,
            submittedById,
          },
          select: pendingChangeSelect,
        })
        .catch(async (err: any) => {
          // Two first-edits racing past getOpenForTour: the partial unique
          // index keeps one row; fold the loser into the winner.
          if (err?.code !== 'P2002') throw err;
          const winner = await this.getOpenForTour(tour.id);
          if (!winner) throw err;
          return null;
        });
      if (created) {
        this.inbox.notify({
          event: InboxEvent.TOUR_SUBMITTED_FOR_REVIEW,
          operatorId: tour.operatorId,
          title: `${tour.name}: content changes need review`,
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
        return created;
      }
    }
    const target = open ?? (await this.getOpenForTour(tour.id));
    if (!target) throw new NotFoundException('Pending change set vanished');
    const current = target.payload as PendingChangePayload;
    const merged: PendingChangePayload = {
      ...(current.tour || patch.tour
        ? { tour: { ...current.tour, ...patch.tour } }
        : {}),
      ...(current.translations || patch.translations
        ? {
            translations: this.mergeTranslations(
              current.translations,
              patch.translations,
            ),
          }
        : {}),
      // The staged gallery is always a whole desired state - last write wins.
      ...(patch.images
        ? { images: patch.images }
        : current.images
          ? { images: current.images }
          : {}),
    };
    return this.prisma.tourPendingChange.update({
      where: { id: target.id },
      data: { payload: merged as Prisma.InputJsonValue },
      select: pendingChangeSelect,
    });
  }

  private mergeTranslations(
    current: PendingChangePayload['translations'],
    incoming: PendingChangePayload['translations'],
  ): Record<string, Record<string, unknown>> {
    const merged: Record<string, Record<string, unknown>> = { ...current };
    for (const [locale, fields] of Object.entries(incoming ?? {})) {
      merged[locale] = { ...merged[locale], ...fields };
    }
    return merged;
  }

  // ── Staged gallery ────────────────────────────────────────────────────────────

  /** The staged gallery for a tour's open change set, or null. */
  async getStagedImages(tourId: string): Promise<StagedImage[] | null> {
    const open = await this.getOpenForTour(tourId);
    const payload = open?.payload as PendingChangePayload | undefined;
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
    await this.stash(tour, submittedById, { images: next });
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
    await this.stash(tour, submittedById, { images: next });
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
    await this.stash(tour, submittedById, {
      images: base.filter((i) => i.id !== imageId),
    });
  }

  /** Staged entry in the same shape the real image endpoints return. */
  toImageShape(tourId: string, img: StagedImage) {
    const { isNew: _isNew, ...rest } = img;
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
    // finding 5).
    if (payload.translations && 'en' in payload.translations) {
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
