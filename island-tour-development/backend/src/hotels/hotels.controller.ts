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
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Locale, Permission } from '@prisma/client';
import {
  CreateHotelDto,
  HotelLocaleQueryDto,
  UpdateHotelDto,
  UpsertHotelTranslationDto,
} from './dto/hotel.dto';
import { HotelsService } from './hotels.service';
import {
  ApiCreateHotelDocs,
  ApiDeleteHotelDocs,
  ApiGetHotelDocs,
  ApiGetHotelTranslationsDocs,
  ApiGetPublicHotelDocs,
  ApiListHotelsDocs,
  ApiUpdateHotelDocs,
  ApiUpsertHotelTranslationDocs,
} from './hotels.swagger';

/**
 * HotelsController - Island Tours' own places to stay, promoted on the thank-you
 * page once a traveller has booked a tour.
 *
 * ## Access-Control Strategy
 *   - `GET /hotels/public` is `@Public()`: the marketing site has no session, and
 *     the payload is copy and image URLs about to be rendered publicly anyway.
 *   - Every other route requires `MANAGE_EDITORIAL` (admin-only). This is our own
 *     marketing content, not platform configuration, so it sits with the homepage
 *     and the other editorial surfaces rather than under MANAGE_SETTINGS.
 *     Operators must never reach it: it advertises OUR property on a page that
 *     follows THEIR booking.
 */
@ApiTags('Hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  /**
   * GET /hotels/public?locale=en
   *
   * Declared before the dynamic routes so `public` is never read as an `:id`, and
   * kept a sibling of the guarded routes so the contrast in access control is
   * obvious at a glance.
   */
  @Get('public')
  @Public()
  @ApiGetPublicHotelDocs()
  getPublic(@Query() query: HotelLocaleQueryDto) {
    return this.hotels.getPublic(query.locale!);
  }

  @Get()
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiListHotelsDocs()
  findAll() {
    return this.hotels.findAll();
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiCreateHotelDocs()
  create(
    @Body() dto: CreateHotelDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hotels.create(dto, user.id);
  }

  // The translation routes are declared before the bare `:id` ones for
  // readability only - the segment counts differ, so there is no ambiguity for
  // Nest to resolve.

  @Get(':id/translations')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGetHotelTranslationsDocs()
  getTranslations(@Param('id', ParseUUIDPipe) id: string) {
    return this.hotels.getTranslations(id);
  }

  @Patch(':id/translations/:locale')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpsertHotelTranslationDocs()
  upsertTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertHotelTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hotels.upsertTranslation(id, locale, dto, user.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGetHotelDocs()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.hotels.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpdateHotelDocs()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHotelDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hotels.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiDeleteHotelDocs()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hotels.remove(id, user.id);
  }
}
