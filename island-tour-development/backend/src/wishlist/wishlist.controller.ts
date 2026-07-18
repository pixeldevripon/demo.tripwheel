import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResolveWishlistQueryDto, WishlistQueryDto } from './dto/wishlist.dto';
import {
  ApiAddWishlistDocs,
  ApiGetWishlistDocs,
  ApiGetWishlistIdsDocs,
  ApiRemoveWishlistDocs,
  ApiResolveWishlistDocs,
} from './wishlist.swagger';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist')
@Controller('wishlist')
/**
 * WishlistController.
 *
 * ## Access-Control Strategy
 * - `GET /wishlist/resolve` is `@Public()`: the live wishlist is COOKIE-BASED
 *   (browser-owned `it.wishlist`, no login required) - this route only shapes
 *   the submitted ids into displayable cards and exposes nothing personal.
 * - Every other route requires a session (no `@Public()` → global `AuthGuard`);
 *   they back the account-synced wishlist and the user id always comes from the
 *   session, never from input (no IDOR risk).
 *
 * ## Route ordering
 * Static `ids` / `resolve` are declared before the dynamic `:tourId` routes.
 */
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Public()
  @Get('resolve')
  @ApiResolveWishlistDocs()
  resolve(@Query() query: ResolveWishlistQueryDto) {
    const ids = query.ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.wishlistService.resolveByIds(ids, query.locale, query.currency);
  }

  @Get()
  @ApiGetWishlistDocs()
  list(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: WishlistQueryDto,
  ) {
    return this.wishlistService.list(user.id, query.locale, query.currency);
  }

  @Get('ids')
  @ApiGetWishlistIdsDocs()
  listIds(@AuthenticatedUser() user: TypedAuthUser) {
    return this.wishlistService.listIds(user.id);
  }

  @Post(':tourId')
  @ApiAddWishlistDocs()
  add(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('tourId') tourId: string,
  ) {
    return this.wishlistService.add(user.id, tourId);
  }

  @Delete(':tourId')
  @ApiRemoveWishlistDocs()
  remove(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('tourId') tourId: string,
  ) {
    return this.wishlistService.remove(user.id, tourId);
  }
}
