import { Injectable, Logger } from '@nestjs/common';
import {
  InboxCategory,
  InboxEvent,
  Permission,
  Prisma,
  Role,
  StaffStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import { INBOX_EVENTS } from './inbox-events';
import type {
  ClearInboxDto,
  ListInboxQueryDto,
  MarkInboxReadDto,
} from './dto/inbox.dto';

/** What a call site supplies. It never says WHO to tell - see inbox-events.ts. */
export interface NotifyInput {
  event: InboxEvent;
  /**
   * The owning operator. Required for `operator`-audience events; on a
   * `platform` event it is recorded for audit and tenancy only.
   */
  operatorId?: string | null;
  title: string;
  body?: string;
  /** Dashboard-relative path, e.g. `/trips/abc/edit?step=review`. */
  url: string;
  entityType?: string;
  entityId?: string;
  /**
   * Who caused it. Excluded from the recipients: nobody needs telling about
   * the button they just pressed. Omit for scheduled/system events.
   */
  actorUserId?: string | null;
  /**
   * Overrides the default `${event}:${entityId}`. Supply one when the same
   * event can legitimately fire twice for one entity - e.g. a tour that is
   * resubmitted after changes, where each round is its own notification.
   */
  dedupeKey?: string;
}

const notificationSelect = {
  id: true,
  category: true,
  event: true,
  title: true,
  body: true,
  url: true,
  entityType: true,
  entityId: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.InboxNotificationSelect;

const DEFAULT_PAGE = 20;
/** How many rows the login digest shows before it starts saying "and N more". */
const DIGEST_SIZE = 5;

/**
 * The dashboard inbox: the bell, the sidebar badges and the login digest.
 *
 * NOT `NotificationsService` - that is the OCTO webhook system, which delivers
 * JSON to OTA partners over HTTP. Nothing is shared between them.
 *
 * ## Fan-out on write
 *
 * `notify()` resolves an audience to real users once, then inserts one row per
 * recipient. The alternative - one row per event, visibility computed at read
 * time - loses on every axis that matters here: per-user read state needs a row
 * anyway, the badge stops being an indexed COUNT, and a permission change
 * silently rewrites history. Freezing the audience at event time is also the
 * behaviour you want; a seat added next month should not inherit last month's
 * alerts.
 *
 * ## No queue
 *
 * Fan-out is two indexed reads and one `createMany`. Putting that behind BullMQ
 * would add a failure mode (Redis) and a delay to buy nothing - the queues doc
 * is explicit that jobs exist for work that is slow, external or retryable, and
 * this is none of the three. It is fire-and-forget instead: `notify()` returns
 * void and swallows its own errors, so a notification can never roll back the
 * booking or the verdict that caused it.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly staffPermissions: StaffPermissionsService,
  ) {}

  /**
   * Record an event for everyone entitled to hear it.
   *
   * Deliberately returns `void` rather than a promise: every call site is a
   * mutation that has already succeeded, and none of them should be able to
   * fail - or even wait - because of a bell.
   */
  notify(input: NotifyInput): void {
    void this.fanOut(input).catch((err: unknown) =>
      this.logger.error(
        `Inbox fan-out failed for ${input.event}${input.entityId ? ` (${input.entityId})` : ''}`,
        err instanceof Error ? err.stack : String(err),
      ),
    );
  }

  /** Exposed for tests and for callers that genuinely need to await delivery. */
  async fanOut(input: NotifyInput): Promise<number> {
    const definition = INBOX_EVENTS[input.event];
    if (!definition) {
      this.logger.error(`Unregistered inbox event ${input.event} - dropped`);
      return 0;
    }

    const needsOperator =
      definition.audience === 'operator' || definition.audience === 'both';
    if (needsOperator && !input.operatorId) {
      // Without an operator there is no audience to resolve, and guessing
      // "everyone" would broadcast an operator's business to every operator.
      this.logger.error(
        `Inbox event ${input.event} is operator-scoped but carried no operatorId - dropped`,
      );
      return 0;
    }

    const [platform, operator] = await Promise.all([
      definition.audience === 'platform' || definition.audience === 'both'
        ? this.platformCandidates()
        : Promise.resolve([]),
      needsOperator
        ? this.operatorCandidates(input.operatorId!)
        : Promise.resolve([]),
    ]);
    // De-duplicate by id: an ADMIN who also owns an operator account would
    // otherwise appear in both lists and hit the unique constraint - which
    // skipDuplicates would swallow, but as a silent half-write.
    const candidates = [
      ...new Map([...platform, ...operator].map((c) => [c.id, c])).values(),
    ];

    const recipients = await this.filterByPermission(
      candidates.filter((c) => c.id !== input.actorUserId),
      definition.permission,
    );
    if (recipients.length === 0) return 0;

    const dedupeKey =
      input.dedupeKey ?? `${input.event}:${input.entityId ?? 'global'}`;

    const { count } = await this.prisma.inboxNotification.createMany({
      // The unique (userId, dedupeKey) does the idempotency; skipping
      // duplicates turns a redelivery into a no-op instead of a 500.
      skipDuplicates: true,
      data: recipients.map((r) => ({
        userId: r.id,
        operatorId: input.operatorId ?? null,
        category: definition.category,
        event: input.event,
        title: input.title,
        body: input.body ?? null,
        url: input.url,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        actorUserId: input.actorUserId ?? null,
        dedupeKey,
      })),
    });
    return count;
  }

  // ── Audience resolution ─────────────────────────────────────────────────────

  /**
   * Island Tours' own people: every ADMIN, plus ACTIVE platform staff seats
   * (a `staff_members` row with no operator).
   *
   * SUSPENDED and INVITED seats are excluded - a seat that cannot sign in
   * should not be accruing an inbox, and a suspended one must not keep
   * receiving the business it was suspended from.
   */
  private async platformCandidates(): Promise<{ id: string; role: Role }[]> {
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        OR: [
          { role: Role.ADMIN },
          {
            role: Role.STAFF,
            staffMember: { operatorId: null, status: StaffStatus.ACTIVE },
          },
        ],
      },
      select: { id: true, role: true },
    });
  }

  /** One operator's account: the owner seat plus its ACTIVE team members. */
  private async operatorCandidates(
    operatorId: string,
  ): Promise<{ id: string; role: Role }[]> {
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        OR: [
          { operator: { id: operatorId } },
          { staffMember: { operatorId, status: StaffStatus.ACTIVE } },
        ],
      },
      select: { id: true, role: true },
    });
  }

  /**
   * Keep only the users who could actually open the page this links to.
   *
   * Reads the SAME effective-permission engine the route guards and the
   * sidebar use, so a designation change moves all three together. Its
   * per-user cache makes this cheap for the common small audience.
   */
  private async filterByPermission(
    candidates: { id: string; role: Role }[],
    permission: Permission,
  ): Promise<{ id: string; role: Role }[]> {
    const checks = await Promise.all(
      candidates.map(async (c) => {
        const { granted } = await this.staffPermissions.hasPermissions(c, [
          permission,
        ]);
        return granted ? c : null;
      }),
    );
    return checks.filter((c): c is { id: string; role: Role } => c !== null);
  }

  // ── Read surface ────────────────────────────────────────────────────────────

  async list(userId: string, query: ListInboxQueryDto) {
    const limit = query.limit ?? DEFAULT_PAGE;
    const where: Prisma.InboxNotificationWhereInput = {
      userId,
      ...(query.category && { category: query.category }),
      ...(query.unreadOnly && { readAt: null }),
      // Keyset paging: an offset would skip or repeat rows as new
      // notifications land at the top mid-scroll.
      ...(query.cursor && { createdAt: { lt: new Date(query.cursor) } }),
    };

    const rows = await this.prisma.inboxNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: notificationSelect,
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      data,
      nextCursor: hasMore
        ? data[data.length - 1].createdAt.toISOString()
        : null,
    };
  }

  /**
   * The bell count and every sidebar badge, from ONE query.
   *
   * They are the same number sliced two ways; computing them separately is how
   * a bell reading 3 ends up next to badges summing to 4.
   */
  async summary(userId: string) {
    const [grouped, latest] = await Promise.all([
      this.prisma.inboxNotification.groupBy({
        by: ['category'],
        where: { userId, readAt: null },
        _count: { _all: true },
      }),
      this.prisma.inboxNotification.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const byCategory: Partial<Record<InboxCategory, number>> = {};
    let unread = 0;
    for (const row of grouped) {
      byCategory[row.category] = row._count._all;
      unread += row._count._all;
    }
    return { unread, byCategory, latestAt: latest?.createdAt ?? null };
  }

  /**
   * Mark rows read. Always scoped by `userId`, so a stranger's id in `ids`
   * matches nothing rather than clearing someone else's inbox.
   */
  async markRead(userId: string, dto: MarkInboxReadDto) {
    const where: Prisma.InboxNotificationWhereInput = { userId, readAt: null };
    if (!dto.all) {
      if (dto.category) where.category = dto.category;
      if (dto.ids?.length) where.id = { in: dto.ids };
      // Neither ids nor category nor all: nothing was asked for. Marking the
      // whole inbox read on an empty body would be a destructive default.
      if (!dto.category && !dto.ids?.length) return { updated: 0 };
    }

    const { count } = await this.prisma.inboxNotification.updateMany({
      where,
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  /**
   * Remove notifications outright - the row's dismiss control, and "Clear all".
   *
   * A hard delete, not a soft one. These rows are a record that someone was
   * TOLD something, not a record OF anything: the booking, the verdict and the
   * payout all still exist, and every one of them has its own audit trail. A
   * `dismissedAt` column would only mean carrying rows forever so that no
   * screen may ever show them.
   *
   * Same shape and the same refusals as `markRead`, including the empty-body
   * one - if the destructive default is wrong for marking read, it is far more
   * wrong here.
   */
  async clear(userId: string, dto: ClearInboxDto) {
    const where: Prisma.InboxNotificationWhereInput = { userId };
    if (!dto.all) {
      if (dto.category) where.category = dto.category;
      if (dto.ids?.length) where.id = { in: dto.ids };
      if (!dto.category && !dto.ids?.length) return { deleted: 0 };
    }
    // Clearing must not silently discard something never looked at, so this is
    // opt-in: "Clear read" is the safe sweep, "Clear all" the deliberate one.
    if (dto.onlyRead) where.readAt = { not: null };

    const { count } = await this.prisma.inboxNotification.deleteMany({ where });
    return { deleted: count };
  }

  /**
   * Dismiss one row. Scoped by `userId`, so someone else's id deletes nothing
   * and reports 0 rather than 404 - the caller's inbox is genuinely unchanged
   * either way, and a 404 would confirm the row exists for somebody.
   */
  async remove(userId: string, id: string) {
    const { count } = await this.prisma.inboxNotification.deleteMany({
      where: { id, userId },
    });
    return { deleted: count };
  }

  /**
   * The once-per-session login modal.
   *
   * The server decides, because the client cannot: "on login" has no
   * client-side event, and mounting the dashboard layout happens on every
   * navigation - keying the modal off mount pops it all day. Calling this
   * stamps `inboxDigestShownAt`, so the next call returns nothing until
   * something new arrives.
   *
   * Returns an empty list rather than a 204 so the caller has one shape to
   * handle; the client renders nothing when `data` is empty.
   */
  async digest(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { inboxDigestShownAt: true },
    });

    const rows = await this.prisma.inboxNotification.findMany({
      where: {
        userId,
        readAt: null,
        ...(user?.inboxDigestShownAt && {
          createdAt: { gt: user.inboxDigestShownAt },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: DIGEST_SIZE,
      select: notificationSelect,
    });

    const unread = await this.prisma.inboxNotification.count({
      where: { userId, readAt: null },
    });

    // Stamp only when there was something to show. Stamping on an empty
    // digest would swallow anything that arrives in the same second.
    if (rows.length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { inboxDigestShownAt: new Date() },
      });
    }

    return { data: rows, unread };
  }
}
