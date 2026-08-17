import { Injectable, Logger } from '@nestjs/common';
import type {
  ConversionEventKind,
  ConversionPlatform,
  ConversionSendStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * The `conversion_events` audit trail (ad-conversion PRD verifiability metric):
 * one row per ad-platform send ATTEMPT, shared by every platform service
 * (Meta CAPI today, Google Ads adjustments in 3c). Best-effort by design -
 * an audit write must never break, or retry-loop, the send path it records.
 */
@Injectable()
export class ConversionAuditService {
  private readonly logger = new Logger(ConversionAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    bookingId: string;
    platform: ConversionPlatform;
    kind: ConversionEventKind;
    eventId: string;
    valueEur: number | null;
    status: ConversionSendStatus;
    error?: string;
  }): Promise<void> {
    try {
      await this.prisma.conversionEvent.create({
        data: {
          bookingId: entry.bookingId,
          platform: entry.platform,
          kind: entry.kind,
          eventId: entry.eventId,
          valueEur: entry.valueEur,
          status: entry.status,
          error: entry.error?.slice(0, 500),
        },
      });
    } catch (err) {
      this.logger.error(
        `conversion_events audit write failed for ${entry.eventId}`,
        err as Error,
      );
    }
  }

  /**
   * True when a SENT row already exists for this exact send - the replay
   * check for platforms that ERROR on a duplicate rather than absorbing it
   * (Google Ads retractions; Meta needs no check, it dedups by event id).
   */
  async alreadySent(args: {
    bookingId: string;
    platform: ConversionPlatform;
    kind: ConversionEventKind;
    eventId: string;
  }): Promise<boolean> {
    const row = await this.prisma.conversionEvent.findFirst({
      where: { ...args, status: 'SENT' },
      select: { id: true },
    });
    return row !== null;
  }
}
