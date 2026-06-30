import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationDeliveryStatus,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { encrypt } from '@/common/utils/crypto.util';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateNotificationSubscriptionDto,
  ListDeliveriesQueryDto,
  NotificationDeliveryResponseDto,
  NotificationSubscriptionResponseDto,
  NotificationSubscriptionWithSecretDto,
  UpdateNotificationSubscriptionDto,
} from './dto/notification.dto';
import { generateSubscriptionSecret } from './notification-signing.util';

/** BullMQ queue name for outbound webhook delivery. */
export const NOTIFICATION_QUEUE = 'notification-delivery';

/** The actor performing a subscription mutation (controller passes the auth user). */
export interface NotificationActor {
  id: string;
  role: Role;
}

/** Context attached to an emitted event so it routes to the right subscriptions. */
export interface EmitContext {
  /** Owning operator of the changed entity; platform subscriptions always receive it. */
  operatorId?: string | null;
}

const subscriptionSelect = {
  id: true,
  operatorId: true,
  url: true,
  notificationTypes: true,
  headers: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotificationSubscriptionSelect;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue,
  ) {}

  // ════════════════════════════════════════════════════════════════════════
  // Emit - fan a change event out to matching subscriptions (fire-and-forget)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `AVAILABILITY_UPDATE` (spec §5.4) - fired whenever inventory for a tour changes
   * (materialization, manual departure edits, exception edits, seat claims/releases).
   * `data` is Availability-Check compatible so the subscriber re-fetches `POST /availability/`.
   */
  emitAvailabilityUpdate(params: {
    tourId: string;
    optionId?: string | null;
    localDate?: string | null;
    operatorId?: string | null;
  }): void {
    const data: Record<string, unknown> = { productId: params.tourId };
    if (params.optionId) data.optionId = params.optionId;
    if (params.localDate) data.localDate = params.localDate;
    void this.emit(NotificationType.AVAILABILITY_UPDATE, data, {
      operatorId: params.operatorId,
    });
  }

  /** `PRODUCT_UPDATE` - fired when a tour's catalog data changes. */
  emitProductUpdate(params: {
    tourId: string;
    operatorId?: string | null;
  }): void {
    void this.emit(
      NotificationType.PRODUCT_UPDATE,
      { productId: params.tourId },
      { operatorId: params.operatorId },
    );
  }

  /** `BOOKING_UPDATE` - fired when a booking's status changes. `uuid` = booking public ref. */
  emitBookingUpdate(params: {
    uuid: string;
    operatorId?: string | null;
  }): void {
    void this.emit(
      NotificationType.BOOKING_UPDATE,
      { uuid: params.uuid },
      { operatorId: params.operatorId },
    );
  }

  /**
   * Resolve matching subscriptions, persist one delivery row each, and enqueue a job.
   * Never throws into the caller - emission failures must not break the originating write.
   */
  async emit(
    notificationType: NotificationType,
    data: Record<string, unknown>,
    ctx: EmitContext = {},
  ): Promise<void> {
    try {
      const operatorScope: Prisma.NotificationSubscriptionWhereInput =
        ctx.operatorId
          ? { OR: [{ operatorId: null }, { operatorId: ctx.operatorId }] }
          : { operatorId: null };

      const subscriptions = await this.prisma.notificationSubscription.findMany(
        {
          where: {
            isActive: true,
            notificationTypes: { has: notificationType },
            ...operatorScope,
          },
          select: { id: true },
        },
      );
      if (subscriptions.length === 0) return;

      const utcCreatedAt = new Date();
      for (const sub of subscriptions) {
        const delivery = await this.prisma.notificationDelivery.create({
          data: {
            subscriptionId: sub.id,
            notificationType,
            payload: {}, // backfilled below with the row id
            status: NotificationDeliveryStatus.PENDING,
          },
          select: { id: true },
        });

        // The delivery id IS the notification id (subscriber-side idempotency).
        const payload = {
          id: delivery.id,
          subscriptionId: sub.id,
          notificationType,
          utcCreatedAt: utcCreatedAt.toISOString(),
          data,
        };
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { payload: payload as unknown as Prisma.InputJsonValue },
        });

        await this.queue.add(
          'deliver',
          { deliveryId: delivery.id },
          {
            jobId: delivery.id,
            attempts: 5,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        );
      }
      this.logger.log(
        `Emitted ${notificationType} to ${subscriptions.length} subscription(s)`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to emit ${notificationType}: ${(err as Error).message}`,
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Subscription CRUD (operator-scoped; admin manages platform-level + any operator)
  // ════════════════════════════════════════════════════════════════════════

  async create(
    dto: CreateNotificationSubscriptionDto,
    actor: NotificationActor,
  ): Promise<NotificationSubscriptionWithSecretDto> {
    const operatorId = await this.scopeForActor(actor);
    const secret = dto.secret ?? generateSubscriptionSecret();

    const row = await this.prisma.notificationSubscription.create({
      data: {
        operatorId,
        url: dto.url,
        secret: encrypt(secret), // stored encrypted at rest; HMAC uses the decrypted value
        notificationTypes: dto.notificationTypes,
        headers: dto.headers ?? {},
      },
      select: subscriptionSelect,
    });
    this.logger.log(
      `Subscription ${row.id} created (operator=${operatorId ?? 'platform'}) by ${actor.id}`,
    );
    // The plaintext secret is surfaced ONCE here and never stored in cleartext.
    return { ...this.map(row), secret };
  }

  async list(
    actor: NotificationActor,
  ): Promise<NotificationSubscriptionResponseDto[]> {
    const where = await this.ownershipWhere(actor);
    const rows = await this.prisma.notificationSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: subscriptionSelect,
    });
    return rows.map((r) => this.map(r));
  }

  async getById(
    id: string,
    actor: NotificationActor,
  ): Promise<NotificationSubscriptionResponseDto> {
    const row = await this.loadOwned(id, actor);
    return this.map(row);
  }

  async update(
    id: string,
    dto: UpdateNotificationSubscriptionDto,
    actor: NotificationActor,
  ): Promise<NotificationSubscriptionResponseDto> {
    await this.loadOwned(id, actor);
    const row = await this.prisma.notificationSubscription.update({
      where: { id },
      data: {
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.notificationTypes !== undefined && {
          notificationTypes: dto.notificationTypes,
        }),
        ...(dto.headers !== undefined && {
          headers: dto.headers,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: subscriptionSelect,
    });
    this.logger.log(`Subscription ${id} updated by ${actor.id}`);
    return this.map(row);
  }

  async remove(
    id: string,
    actor: NotificationActor,
  ): Promise<{ id: string; deleted: true }> {
    await this.loadOwned(id, actor);
    await this.prisma.notificationSubscription.delete({ where: { id } });
    this.logger.log(`Subscription ${id} deleted by ${actor.id}`);
    return { id, deleted: true };
  }

  async listDeliveries(
    id: string,
    query: ListDeliveriesQueryDto,
    actor: NotificationActor,
  ): Promise<{
    total: number;
    page: number;
    limit: number;
    data: NotificationDeliveryResponseDto[];
  }> {
    await this.loadOwned(id, actor);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationDeliveryWhereInput = {
      subscriptionId: id,
      ...(query.status && { status: query.status }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notificationDelivery.count({ where }),
      this.prisma.notificationDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      total,
      page,
      limit,
      data: rows.map((r) => ({
        id: r.id,
        subscriptionId: r.subscriptionId,
        notificationType: r.notificationType,
        status: r.status,
        attempts: r.attempts,
        lastError: r.lastError,
        deliveredAt: r.deliveredAt,
        createdAt: r.createdAt,
      })),
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Ownership helpers
  // ════════════════════════════════════════════════════════════════════════

  /** The operatorId a NEW subscription gets: null for admin (platform), own id for operators. */
  private async scopeForActor(
    actor: NotificationActor,
  ): Promise<string | null> {
    if (actor.role === Role.ADMIN) return null;
    return resolveOperatorId(this.prisma, actor.id, actor.role);
  }

  /** Filter that restricts queries to rows the actor may see. */
  private async ownershipWhere(
    actor: NotificationActor,
  ): Promise<Prisma.NotificationSubscriptionWhereInput> {
    if (actor.role === Role.ADMIN) return {};
    const operatorId = await resolveOperatorId(
      this.prisma,
      actor.id,
      actor.role,
    );
    return { operatorId };
  }

  /** Loads a subscription and asserts the actor owns it (or is admin). */
  private async loadOwned(id: string, actor: NotificationActor) {
    const row = await this.prisma.notificationSubscription.findUnique({
      where: { id },
      select: subscriptionSelect,
    });
    if (!row)
      throw new NotFoundException('Notification subscription not found');
    if (actor.role !== Role.ADMIN) {
      const operatorId = await resolveOperatorId(
        this.prisma,
        actor.id,
        actor.role,
      );
      if (row.operatorId !== operatorId) {
        throw new ForbiddenException('You do not own this subscription');
      }
    }
    return row;
  }

  private map(
    row: Prisma.NotificationSubscriptionGetPayload<{
      select: typeof subscriptionSelect;
    }>,
  ): NotificationSubscriptionResponseDto {
    return {
      id: row.id,
      operatorId: row.operatorId,
      url: row.url,
      notificationTypes: row.notificationTypes,
      headers: (row.headers as Record<string, string> | null) ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
