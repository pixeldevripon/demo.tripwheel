import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/auth/decorators/public.decorator';
import { EmailPreferencesService } from './email-preferences.service';
import {
  ApiActOnUnsubscribeTokenDocs,
  ApiResolveUnsubscribeTokenDocs,
} from './email-preferences.swagger';

/**
 * The public unsubscribe endpoints (EMAIL-IMPLEMENTATION-PLAN.md §2.5).
 *
 * `@Public()` because the recipient clicked a link in an email — there is no
 * session and demanding one before honouring "stop emailing me" is a
 * compliance failure. The token in the path is the credential (the
 * review-invitation precedent), so the routes are throttled to a human pace
 * and unknown tokens 404 identically. Both routes are static-prefixed
 * (`unsubscribe/:token`) — no static/dynamic ordering hazard.
 */
@ApiTags('Email preferences')
@Controller('email')
export class EmailPreferencesController {
  constructor(private readonly preferences: EmailPreferencesService) {}

  @Get('unsubscribe/:token')
  @Public()
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @ApiResolveUnsubscribeTokenDocs()
  resolve(@Param('token') token: string) {
    return this.preferences.resolveToken(token);
  }

  @Post('unsubscribe/:token')
  @Public()
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @ApiActOnUnsubscribeTokenDocs()
  optOut(@Param('token') token: string) {
    return this.preferences.optOut(token);
  }
}
