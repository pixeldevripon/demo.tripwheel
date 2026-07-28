import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import {
  PublicInstagramFeedQueryDto,
  ReorderInstagramPostsDto,
  SaveInstagramCredentialsDto,
  UpdateInstagramAccountDto,
  UpdateInstagramPostDto,
} from './dto/instagram.dto';
import { InstagramConfigService } from './instagram-config.service';
import { InstagramService } from './instagram.service';
import { InstagramSyncService } from './instagram-sync.service';
import { InstagramTokenService } from './instagram-token.service';
import {
  ApiDeleteInstagramPostDocs,
  ApiGetInstagramAccountDocs,
  ApiGetInstagramConnectionDocs,
  ApiGetInstagramCredentialsDocs,
  ApiGetPublicInstagramFeedDocs,
  ApiListInstagramPostsDocs,
  ApiReorderInstagramPostsDocs,
  ApiSaveInstagramCredentialsDocs,
  ApiSyncInstagramDocs,
  ApiUpdateInstagramAccountDocs,
  ApiUpdateInstagramPostDocs,
} from './instagram.swagger';

/**
 * InstagramController - the brand Instagram grid on destination pages.
 *
 * ## Access
 * - Reads of the curation surface require VIEW_SETTINGS, writes MANAGE_SETTINGS
 *   (same split as the settings and platform-reviews modules).
 * - `GET public/feed` is `@Public` and serves only rendered-tile fields.
 *
 * ## Auto-sync
 * The feed is a mirror of the connected account: an admin pastes a long-lived
 * access token in the dashboard, a daily job pulls + mirrors the media, and the
 * only per-tile curation left is reorder (`PATCH posts/reorder`) and
 * hide/alt/island (`PATCH posts/:id`). There is no manual tile-create path and
 * no OAuth - the token IS the credential.
 */
@ApiTags('Instagram')
@Controller('instagram')
export class InstagramController {
  constructor(
    private readonly instagram: InstagramService,
    private readonly tokens: InstagramTokenService,
    private readonly sync: InstagramSyncService,
    private readonly config: InstagramConfigService,
  ) {}

  /** Declared first so `public` is never matched as a dynamic segment. */
  @Get('public/feed')
  @Public()
  @ApiGetPublicInstagramFeedDocs()
  getPublicFeed(@Query() query: PublicInstagramFeedQueryDto) {
    return this.instagram.getPublicFeed(query.destination, query.limit);
  }

  // ── Credentials (dashboard-editable app config) ─────────────────────────────

  @Get('credentials')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetInstagramCredentialsDocs()
  getCredentials() {
    return this.config.getCredentialStatus();
  }

  @Patch('credentials')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiSaveInstagramCredentialsDocs()
  async saveCredentials(@Body() dto: SaveInstagramCredentialsDto) {
    await this.config.saveCredentials(dto);
    return this.config.getCredentialStatus();
  }

  // ── Connection (token status) ───────────────────────────────────────────────

  @Get('connection')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetInstagramConnectionDocs()
  getConnection() {
    return this.tokens.getConnection();
  }

  @Post('sync')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiSyncInstagramDocs()
  syncNow() {
    return this.sync.syncNow();
  }

  // ── Account header (handle / profile link / layout) ─────────────────────────

  @Get('account')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetInstagramAccountDocs()
  getAccount() {
    return this.instagram.getAccount();
  }

  @Patch('account')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateInstagramAccountDocs()
  updateAccount(
    @Body() dto: UpdateInstagramAccountDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.instagram.updateAccount(dto, user.id);
  }

  // ── Tiles (curation only: reorder + hide/alt/island) ────────────────────────

  @Get('posts')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiListInstagramPostsDocs()
  listPosts() {
    return this.instagram.listPosts();
  }

  /** Static route, so it must precede `posts/:id`. */
  @Patch('posts/reorder')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiReorderInstagramPostsDocs()
  reorderPosts(
    @Body() dto: ReorderInstagramPostsDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.instagram.reorderPosts(dto, user.id);
  }

  @Patch('posts/:id')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateInstagramPostDocs()
  updatePost(
    @Param('id') id: string,
    @Body() dto: UpdateInstagramPostDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.instagram.updatePost(id, dto, user.id);
  }

  @Delete('posts/:id')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiDeleteInstagramPostDocs()
  removePost(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.instagram.removePost(id, user.id);
  }
}
