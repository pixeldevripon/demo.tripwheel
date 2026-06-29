import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WishlistQueryDto } from './dto/wishlist.dto';
import {
  ApiAddWishlistDocs,
  ApiGetWishlistDocs,
  ApiGetWishlistIdsDocs,
  ApiRemoveWishlistDocs,
} from './wishlist.swagger';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist')
@Controller('wishlist')
/**
 * WishlistController - a USER-level capability (any authenticated user).
 *
 * ## Access-Control Strategy
 * - No `@Public()` → the global `AuthGuard` requires a valid session.
 * - No `@RequirePermissions()` → being authenticated is sufficient; the user id
 *   comes from the session, never from input, so there is no IDOR risk (a user
 *   can only ever read/mutate their own wishlist).
 *
 * ## Route ordering
 * Static `ids` is declared before the dynamic `:tourId` routes.
 */
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiGetWishlistDocs()
  list(@AuthenticatedUser() user: TypedAuthUser, @Query() query: WishlistQueryDto) {
    return this.wishlistService.list(user.id, query.locale);
  }

  @Get('ids')
  @ApiGetWishlistIdsDocs()
  listIds(@AuthenticatedUser() user: TypedAuthUser) {
    return this.wishlistService.listIds(user.id);
  }

  @Post(':tourId')
  @ApiAddWishlistDocs()
  add(@AuthenticatedUser() user: TypedAuthUser, @Param('tourId') tourId: string) {
    return this.wishlistService.add(user.id, tourId);
  }

  @Delete(':tourId')
  @ApiRemoveWishlistDocs()
  remove(@AuthenticatedUser() user: TypedAuthUser, @Param('tourId') tourId: string) {
    return this.wishlistService.remove(user.id, tourId);
  }
}
