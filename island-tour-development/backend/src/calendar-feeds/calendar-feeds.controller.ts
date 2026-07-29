import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import type { Response } from 'express';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
import { CalendarFeedsService } from './calendar-feeds.service';
import { CreateCalendarFeedDto } from './dto/calendar-feed.dto';
import {
  ApiCreateCalendarFeedDocs,
  ApiListCalendarFeedsDocs,
  ApiRenderCalendarFeedDocs,
  ApiRevokeCalendarFeedDocs,
  ApiRotateCalendarFeedDocs,
} from './calendar-feeds.swagger';

/**
 * CalendarFeedsController - the operator's read-only iCal export.
 *
 * ## Access
 * - Management routes require `MANAGE_AVAILABILITY`; the service scopes every one
 *   to the caller's own operator and applies the per-kind bar on top (BOOKINGS
 *   also needs `VIEW_BOOKINGS`).
 * - The `.ics` route is `@Public()` because calendar clients cannot carry a
 *   session cookie. Its 256-bit token is the credential.
 */
@ApiTags('Calendar Feeds')
@Controller('calendar-feeds')
export class CalendarFeedsController {
  constructor(private readonly feeds: CalendarFeedsService) {}

  // ── Management ──────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiListCalendarFeedsDocs()
  list(@AuthenticatedUser() user: TypedAuthUser) {
    return this.feeds.list({ id: user.id, role: user.role });
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiCreateCalendarFeedDocs()
  create(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: CreateCalendarFeedDto,
  ) {
    return this.feeds.create({ id: user.id, role: user.role }, dto);
  }

  @Post(':id/rotate')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiRotateCalendarFeedDocs()
  rotate(@AuthenticatedUser() user: TypedAuthUser, @Param('id') id: string) {
    return this.feeds.rotate({ id: user.id, role: user.role }, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiRevokeCalendarFeedDocs()
  revoke(@AuthenticatedUser() user: TypedAuthUser, @Param('id') id: string) {
    return this.feeds.revoke({ id: user.id, role: user.role }, id);
  }

  // ── The subscribable feed ───────────────────────────────────────────────────

  /**
   * `.ics` sits in its own static segment rather than suffixing the param
   * (`:token.ics`), matching the booking calendar route - a param immediately
   * followed by a literal dot is exactly the pattern that shifted meaning between
   * path-to-regexp versions, and a URL an operator has already subscribed to must
   * not break on a router upgrade.
   *
   * `@Res({ passthrough: true })` is here for conditional GET only: Google Calendar
   * re-polls a feed relentlessly, and without a 304 path every poll would re-send
   * the whole year of events. Nest still serialises the returned body.
   */
  @Get(':token/calendar.ics')
  @Public()
  @ApiRenderCalendarFeedDocs()
  async render(
    @Param('token') token: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string | undefined> {
    const feed = await this.feeds.render(token);

    res.setHeader('ETag', feed.etag);
    res.setHeader('Last-Modified', feed.lastModified.toUTCString());
    // `private` because the BOOKINGS feed is operator-confidential and must never
    // be held by a shared proxy.
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="island-tours.ics"');

    // If-None-Match may carry a list, and a proxy is allowed to weaken the tag.
    if (ifNoneMatch && matchesEtag(ifNoneMatch, feed.etag)) {
      res.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }

    this.feeds.recordFetch(token);
    return feed.body;
  }
}

/** RFC 9110 §13.1.2 - comma-separated list, `W/` prefixes ignored, `*` matches all. */
function matchesEtag(header: string, etag: string): boolean {
  const normalise = (v: string) => v.trim().replace(/^W\//, '');
  const candidates = header.split(',').map(normalise);
  return candidates.includes('*') || candidates.includes(normalise(etag));
}
