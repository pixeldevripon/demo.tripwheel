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
  ActiveHubsQueryDto,
  AddAllowedCategoryDto,
  CreateHubDto,
  HubBySlugQueryDto,
  HubQueryDto,
  UpdateHubDto,
} from './dto/hub.dto';
import { HubService } from './hubs.service';
import {
  ApiAddAllowedCategoryDocs,
  ApiCreateHubDocs,
  ApiDeleteHubDocs,
  ApiGetActiveHubsDocs,
  ApiGetAllHubsDocs,
  ApiGetHubByIdDocs,
  ApiGetHubBySlugDocs,
  ApiRemoveAllowedCategoryDocs,
  ApiUpdateHubDocs,
} from './hubs.swagger';

@ApiTags('Hubs')
@Controller('hubs')
/**
 * HubController — manages destination-specific activity hubs (e.g. Klein Curaçao).
 *
 * ## Access-Control Strategy
 * - GET endpoints are `@Public()` — needed for frontend SSR and tour-creation wizard.
 * - All mutating endpoints require `MANAGE_HUBS` permission (Admin + Editor only).
 *
 * ## Slug lifecycle
 * - Slug auto-generated from name at creation; immutable after creation.
 * - DELETE is a soft-delete (`isActive = false`) because slug_registry rows are permanent.
 * - Seeded hubs (isSeeded = true) and hubs with active trips cannot be deactivated.
 *
 * ## Allowed categories sub-routes
 * - `POST /hubs/:id/allowed-categories` and `DELETE /hubs/:id/allowed-categories/:categoryId`
 *   control which tour categories can be assigned to trips in this hub.
 *
 * ## Route ordering
 * Static segment `active` MUST be declared before the dynamic `:id` segment.
 */
export class HubController {
  constructor(private readonly hubService: HubService) {}

  /**
   * GET /hubs
   *
   * Public paginated list. Supports filtering by destinationId and isActive.
   */
  @Get()
  @Public()
  @ApiGetAllHubsDocs()
  getAll(@Query() query: HubQueryDto) {
    return this.hubService.getAll(query);
  }

  /**
   * GET /hubs/active
   *
   * Returns all active hubs, optionally filtered by destinationId.
   * Declared before `:id` to prevent NestJS matching "active" as a UUID param.
   */
  @Get('active')
  @Public()
  @ApiGetActiveHubsDocs()
  getActive(@Query() query: ActiveHubsQueryDto) {
    return this.hubService.getActive(query);
  }

  /**
   * GET /hubs/slug/:slug?destinationSlug=curacao
   *
   * Public lookup by hub slug. Hub slugs are unique per destination, so
   * `destinationSlug` is a required query param.
   * Declared before `:id` to avoid NestJS treating "slug" as a UUID.
   */
  @Get('slug/:slug')
  @Public()
  @ApiGetHubBySlugDocs()
  getBySlug(
    @Param('slug') slug: string,
    @Query() query: HubBySlugQueryDto,
  ) {
    return this.hubService.getBySlug(slug, query);
  }

  /**
   * GET /hubs/:id
   *
   * Public single-hub lookup by UUID. Includes allowedCategories.
   */
  @Get(':id')
  @Public()
  @ApiGetHubByIdDocs()
  getById(@Param('id') id: string) {
    return this.hubService.getById(id);
  }

  /**
   * POST /hubs
   *
   * Admin/Editor only. In one atomic transaction:
   *  - creates the hub with an auto-generated slug
   *  - seeds one slug_registry row for the hub's destination
   *  - optionally seeds initial allowed category rows
   *
   * Security: requires `MANAGE_HUBS`.
   */
  @Post()
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiCreateHubDocs()
  create(
    @Body() dto: CreateHubDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.create(dto, user.id);
  }

  /**
   * PATCH /hubs/:id
   *
   * Admin/Editor only. Updates display name, description, or active status.
   * Slug is immutable after creation. If `isActive` changes, the slug_registry
   * row is mirrored in the same transaction.
   *
   * Security: requires `MANAGE_HUBS`.
   */
  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpdateHubDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHubDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.update(id, dto, user.id);
  }

  /**
   * DELETE /hubs/:id
   *
   * Admin/Editor only. Soft-delete: sets `isActive = false` on the hub and
   * its slug_registry row. Seeded hubs and those with active trips are blocked.
   *
   * Security: requires `MANAGE_HUBS`.
   */
  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiDeleteHubDocs()
  remove(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.remove(id, user.id);
  }

  /**
   * POST /hubs/:id/allowed-categories
   *
   * Adds a category to the hub's allowed list. Operators can only assign
   * categories from this list when creating hub-anchored trips.
   *
   * Security: requires `MANAGE_HUBS`.
   */
  @Post(':id/allowed-categories')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiAddAllowedCategoryDocs()
  addAllowedCategory(
    @Param('id') id: string,
    @Body() dto: AddAllowedCategoryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.addAllowedCategory(id, dto, user.id);
  }

  /**
   * DELETE /hubs/:id/allowed-categories/:categoryId
   *
   * Removes a category from the hub's allowed list.
   *
   * Security: requires `MANAGE_HUBS`.
   */
  @Delete(':id/allowed-categories/:categoryId')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiRemoveAllowedCategoryDocs()
  removeAllowedCategory(
    @Param('id') id: string,
    @Param('categoryId') categoryId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.removeAllowedCategory(id, categoryId, user.id);
  }
}
