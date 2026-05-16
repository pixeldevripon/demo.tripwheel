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
import { DestinationService } from './destinations.service';
import {
  ApiCreateDestinationDocs,
  ApiDeleteDestinationDocs,
  ApiGetActiveDestinationsDocs,
  ApiGetAllDestinationsDocs,
  ApiGetDestinationByIdDocs,
  ApiGetDestinationBySlugDocs,
  ApiUpdateDestinationDocs,
} from './destinations.swagger';
import {
  CreateDestinationDto,
  DestinationQueryDto,
  UpdateDestinationDto,
} from './dto/destination.dto';

@ApiTags('Destinations')
@Controller('destinations')
/**
 * DestinationController — manages Caribbean island destinations (Curaçao, Aruba, etc.)
 *
 * ## Access-Control Strategy
 * - GET endpoints are `@Public()` — destinations are needed for frontend SSR.
 * - Mutating endpoints require explicit destination permissions (Admin + Editor only).
 *
 * ## Slug lifecycle
 * - Slug is auto-generated from name at creation; immutable after creation.
 * - DELETE is a soft-delete (`isActive = false`); seeded destinations and those
 *   with active trips cannot be deactivated.
 *
 * ## Create transaction
 * - Creates destination + seeds one RESERVED 'tours' slug_registry row
 *   + seeds one CATEGORY slug_registry row per existing active category.
 *
 * ## Route ordering
 * Static segment `active` MUST be declared before the dynamic `:id` segment.
 */
export class DestinationController {
  constructor(private readonly destinationService: DestinationService) {}

  /**
   * GET /destinations
   *
   * Public paginated list. Supports filtering by isActive.
   */
  @Get()
  @Public()
  @ApiGetAllDestinationsDocs()
  getAll(@Query() query: DestinationQueryDto) {
    return this.destinationService.getAll(query);
  }

  /**
   * GET /destinations/active
   *
   * Returns all active destinations without pagination.
   * Declared before `:id` to prevent NestJS matching "active" as a UUID param.
   */
  @Get('active')
  @Public()
  @ApiGetActiveDestinationsDocs()
  getActive() {
    return this.destinationService.getActive();
  }

  /**
   * GET /destinations/slug/:slug
   *
   * Public lookup by destination slug. Destination slugs are globally unique.
   * Declared before `:id` to avoid NestJS treating "slug" as a UUID.
   */
  @Get('slug/:slug')
  @Public()
  @ApiGetDestinationBySlugDocs()
  getBySlug(@Param('slug') slug: string) {
    return this.destinationService.getBySlug(slug);
  }

  /**
   * GET /destinations/:id
   *
   * Public single-destination lookup by UUID.
   */
  @Get(':id')
  @Public()
  @ApiGetDestinationByIdDocs()
  getById(@Param('id') id: string) {
    return this.destinationService.getById(id);
  }

  /**
   * POST /destinations
   *
   * Admin/Editor only. In one atomic transaction:
   *  - creates the destination with an auto-generated slug
   *  - seeds one RESERVED slug_registry row for 'tours'
   *  - seeds one CATEGORY slug_registry row per existing active category
   *
   * Security: requires `CREATE_DESTINATION`.
   */
  @Post()
  @RequirePermissions(Permission.CREATE_DESTINATION)
  @ApiCreateDestinationDocs()
  create(
    @Body() dto: CreateDestinationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.create(dto, user.id);
  }

  /**
   * PATCH /destinations/:id
   *
   * Admin/Editor only. Updates display name, hero image, or active status.
   * Slug is immutable after creation.
   *
   * Security: requires `EDIT_DESTINATION`.
   */
  @Patch(':id')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpdateDestinationDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDestinationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.update(id, dto, user.id);
  }

  /**
   * DELETE /destinations/:id
   *
   * Admin/Editor only. Soft-delete: sets `isActive = false`.
   * Seeded destinations and those with existing trips are blocked.
   *
   * Security: requires `DELETE_DESTINATION`.
   */
  @Delete(':id')
  @RequirePermissions(Permission.DELETE_DESTINATION)
  @ApiDeleteDestinationDocs()
  remove(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.remove(id, user.id);
  }
}
