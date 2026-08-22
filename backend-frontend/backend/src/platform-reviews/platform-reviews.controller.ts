import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { Permission } from '@prisma/client';
import { UpdatePlatformReviewsConfigDto } from './dto/platform-reviews.dto';
import { PlatformReviewsService } from './platform-reviews.service';
import {
  ApiGetPlatformReviewsConfigDocs,
  ApiPublicPlatformReviewsDocs,
  ApiRefreshPlatformReviewsDocs,
  ApiUpdatePlatformReviewsConfigDocs,
} from './platform-reviews.swagger';

/**
 * PlatformReviewsController - Trustpilot / Google Reviews integration
 * (master point 15).
 *
 * ## Access
 * - Config read requires VIEW_SETTINGS; writes and manual refresh require
 *   MANAGE_SETTINGS (same split as the settings module - the API key is a
 *   sensitive credential).
 * - `GET public` is `@Public`: it serves only the normalized, gated payload
 *   (never the key), from the DB cache.
 */
@ApiTags('Platform Reviews')
@Controller('platform-reviews')
export class PlatformReviewsController {
  constructor(private readonly service: PlatformReviewsService) {}

  @Get('public')
  @Public()
  @ApiPublicPlatformReviewsDocs()
  getPublic() {
    return this.service.getPublic();
  }

  @Get('config')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetPlatformReviewsConfigDocs()
  getConfig() {
    return this.service.getConfig();
  }

  @Put('config')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdatePlatformReviewsConfigDocs()
  updateConfig(@Body() dto: UpdatePlatformReviewsConfigDto) {
    return this.service.updateConfig(dto);
  }

  @Post('refresh')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiRefreshPlatformReviewsDocs()
  refresh() {
    return this.service.refresh();
  }
}
