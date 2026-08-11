import { Body, Controller, Get, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permission } from '@prisma/client';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import type { AuthenticatedRequest, TypedAuthUser } from '@/auth/auth.types';
import {
  EmailPeopleQueryDto,
  EmailSendsQueryDto,
  TestSendDto,
  UpdateEmailSettingsDto,
} from './dto/email-centre.dto';
import { EmailCentreService } from './email-centre.service';
import { EmailTestSendService } from './email-test-send.service';
import {
  ApiGetEmailSettingsDocs,
  ApiListEmailConsentsDocs,
  ApiListEmailOptOutsDocs,
  ApiListEmailSendsDocs,
  ApiTestSendDocs,
  ApiUpdateEmailSettingsDocs,
} from './email-centre.swagger';

/**
 * WP-H (checklist H-04…H-07): the dashboard email centre API — settings
 * switchboard, global activity list, people lists and test-send.
 *
 * Everything here is `MANAGE_SYSTEM` (admin-only): the switchboard starts
 * and stops emails to real customers, and the lists expose traveller and
 * operator addresses. Shares the `/email` prefix with the PUBLIC unsubscribe
 * routes (EmailPreferencesController) — all paths here are static, so there
 * is no static/dynamic ordering hazard with `unsubscribe/:token`.
 */
@ApiTags('Email centre')
@Controller('email')
export class EmailCentreController {
  constructor(
    private readonly centre: EmailCentreService,
    private readonly testSends: EmailTestSendService,
  ) {}

  @Get('settings')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiGetEmailSettingsDocs()
  getSettings() {
    return this.centre.getSettings();
  }

  /**
   * Throttled like the /settings PATCHes: this flips switches that mail real
   * customers, and nobody legitimately edits it 5+ times a minute.
   */
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @Patch('settings')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiUpdateEmailSettingsDocs()
  updateSettings(@Body() dto: UpdateEmailSettingsDto) {
    return this.centre.updateSettings(dto);
  }

  @Get('sends')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiListEmailSendsDocs()
  listSends(@Query() query: EmailSendsQueryDto) {
    return this.centre.listSends(query);
  }

  @Get('opt-outs')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiListEmailOptOutsDocs()
  listOptOuts(@Query() query: EmailPeopleQueryDto) {
    return this.centre.listOptOuts(query);
  }

  @Get('consents')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiListEmailConsentsDocs()
  listConsents(@Query() query: EmailPeopleQueryDto) {
    return this.centre.listConsents(query);
  }

  /**
   * Sends to the CALLER's own address only — the request body carries no
   * recipient, so this can never be used to mail anyone else.
   */
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @Post('test-send')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiTestSendDocs()
  testSend(@Req() req: AuthenticatedRequest, @Body() dto: TestSendDto) {
    // AuthGuard guarantees `user` on guarded routes.
    const user = req.user as TypedAuthUser;
    return this.testSends.testSend(
      { id: user.id, email: user.email },
      dto.templateKey,
    );
  }
}
