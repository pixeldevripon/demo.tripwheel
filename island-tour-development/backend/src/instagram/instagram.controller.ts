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
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import {
  CreateInstagramPostDto,
  PublicInstagramFeedQueryDto,
  ReorderInstagramPostsDto,
  UpdateInstagramAccountDto,
  UpdateInstagramPostDto,
} from './dto/instagram.dto';
import { InstagramService } from './instagram.service';
import {
  ApiCreateInstagramPostDocs,
  ApiDeleteInstagramPostDocs,
  ApiGetInstagramAccountDocs,
  ApiGetPublicInstagramFeedDocs,
  ApiListInstagramPostsDocs,
  ApiReorderInstagramPostsDocs,
  ApiUpdateInstagramAccountDocs,
  ApiUpdateInstagramPostDocs,
} from './instagram.swagger';

/**
 * InstagramController - the brand Instagram grid on destination pages.
 *
 * ## Access
 * - Reads of the curation surface require VIEW_SETTINGS, writes MANAGE_SETTINGS
 *   (same split as the settings and platform-reviews modules: the feed is
 *   configured from Settings, not from the editorial pages).
 * - `GET public/feed` is `@Public` and serves only rendered-tile fields.
 */
@ApiTags('Instagram')
@Controller('instagram')
export class InstagramController {
  constructor(private readonly instagram: InstagramService) {}

  /** Declared first so `public` is never matched as a dynamic segment. */
  @Get('public/feed')
  @Public()
  @ApiGetPublicInstagramFeedDocs()
  getPublicFeed(@Query() query: PublicInstagramFeedQueryDto) {
    return this.instagram.getPublicFeed(query.destination, query.limit);
  }

  @Get('account')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetInstagramAccountDocs()
  getAccount() {
    return this.instagram.getAccount();
  }

  @Put('account')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateInstagramAccountDocs()
  updateAccount(
    @Body() dto: UpdateInstagramAccountDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.instagram.updateAccount(dto, user.id);
  }

  @Get('posts')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiListInstagramPostsDocs()
  listPosts() {
    return this.instagram.listPosts();
  }

  @Post('posts')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiCreateInstagramPostDocs()
  createPost(
    @Body() dto: CreateInstagramPostDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.instagram.createPost(dto, user.id);
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
