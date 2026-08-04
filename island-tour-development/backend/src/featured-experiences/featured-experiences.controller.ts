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
  CreateFeaturedExperienceDto,
  PublicExperiencesQueryDto,
  UpdateFeaturedExperienceDto,
} from './dto/featured-experience.dto';
import { FeaturedExperiencesService } from './featured-experiences.service';
import {
  ApiCreateFeaturedExperienceDocs,
  ApiDeleteFeaturedExperienceDocs,
  ApiGetPublicExperiencesDocs,
  ApiListFeaturedExperiencesDocs,
  ApiUpdateFeaturedExperienceDocs,
} from './featured-experiences.swagger';

/**
 * "Top Island Experiences" - presentation-only homepage reel cards (founder,
 * 2026-08-04): an admin-typed label + poster + optional video, no category/hub
 * reference and no links. Public reads are open; curation requires
 * MANAGE_EDITORIAL, matching the homepage content module.
 */
@ApiTags('Featured Experiences')
@Controller('featured-experiences')
export class FeaturedExperiencesController {
  constructor(private readonly featured: FeaturedExperiencesService) {}

  /** Declared before `:id` routes so `public` is never read as a parameter. */
  @Get('public')
  @Public()
  @ApiGetPublicExperiencesDocs()
  // The query DTO is validated but unused: `locale`/`destination` are accepted
  // for compatibility with deployed frontends and ignored (see the DTO note).
  getPublic(@Query() _query: PublicExperiencesQueryDto) {
    return this.featured.resolvePublic();
  }

  @Get()
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiListFeaturedExperiencesDocs()
  list() {
    return this.featured.list();
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiCreateFeaturedExperienceDocs()
  create(
    @Body() dto: CreateFeaturedExperienceDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.featured.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpdateFeaturedExperienceDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFeaturedExperienceDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.featured.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiDeleteFeaturedExperienceDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.featured.remove(id, user.id);
  }
}
