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
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
import { ReviewsService } from './reviews.service';
import {
  AdminReviewsQueryDto,
  BulkModerateReviewsDto,
  CreateReviewDto,
  DeleteReviewDto,
  FeatureReviewDto,
  FlagReviewDto,
  ListReviewsQueryDto,
  ModerateReviewDto,
  ModerationQueueQueryDto,
  ResolveFlagDto,
  RespondToReviewDto,
  SetThemeTagsDto,
  SummaryQueryDto,
} from './dto/review.dto';
import {
  ApiAdminListReviewsDocs,
  ApiBulkModerateDocs,
  ApiCreateReviewDocs,
  ApiDeleteReviewDocs,
  ApiFeatureReviewDocs,
  ApiFlagReviewDocs,
  ApiGetReviewDocs,
  ApiListReviewsDocs,
  ApiModerateReviewDocs,
  ApiModerationHistoryDocs,
  ApiModerationQueueDocs,
  ApiMyReviewsDocs,
  ApiOperatorListReviewsDocs,
  ApiResolveFlagDocs,
  ApiRespondReviewDocs,
  ApiReviewSummaryDocs,
  ApiThemeTagsDocs,
} from './reviews.swagger';

/**
 * ReviewsController - per-tour, booking-gated reviews with moderation.
 *
 * ## Access
 * - Public: list approved reviews, rating summary, get an approved review.
 * - Authenticated: create (booking owner), own list, delete (author/admin),
 *   flag (tour owner/admin).
 * - `VIEW_REVIEWS`: the cross-tour admin queue and one review's audit trail.
 * - `APPROVE_REVIEW`: moderate, bulk-moderate, respond, resolve flags.
 * - `EDIT_REVIEW`: theme chips and the editorial feature toggle.
 *
 * There is deliberately NO helpful-vote endpoint (deferred to V2) and no
 * operator write path other than flagging: operators cannot delete, unpublish
 * or edit a review, only ask Island Tours to look at one.
 *
 * Static routes precede `:id` routes (NestJS matches top-to-bottom).
 */
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @ApiCreateReviewDocs()
  create(
    @Body() dto: CreateReviewDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.reviews.create(dto, user.id);
  }

  @Get()
  @Public()
  @ApiListReviewsDocs()
  list(@Query() query: ListReviewsQueryDto) {
    return this.reviews.list(query);
  }

  @Get('summary')
  @Public()
  @ApiReviewSummaryDocs()
  summary(@Query() query: SummaryQueryDto) {
    return this.reviews.summary(query.tourId);
  }

  @Get('mine')
  @ApiMyReviewsDocs()
  mine(@AuthenticatedUser() user: TypedAuthUser) {
    return this.reviews.listMine(user.id);
  }

  @Get('admin')
  @RequirePermissions(Permission.VIEW_REVIEWS)
  @ApiAdminListReviewsDocs()
  adminList(
    @Query() query: AdminReviewsQueryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    // Scoped by ACTOR, not by permission. `VIEW_REVIEWS` is held by operators
    // too, so passing the query alone let any operator read every other
    // operator's queue through this route.
    return this.reviews.listForActor(query, { id: user.id, role: user.role });
  }

  @Get('operator')
  @RequirePermissions(Permission.VIEW_REVIEWS)
  @ApiOperatorListReviewsDocs()
  operatorList(
    @Query() query: AdminReviewsQueryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.reviews.operatorList(query, {
      id: user.id,
      role: user.role,
    });
  }

  @Get('pending')
  @RequirePermissions(Permission.APPROVE_REVIEW)
  @ApiModerationQueueDocs()
  pending(@Query() query: ModerationQueueQueryDto) {
    return this.reviews.moderationQueue(query);
  }

  @Patch('bulk-moderate')
  @RequirePermissions(Permission.APPROVE_REVIEW)
  @ApiBulkModerateDocs()
  bulkModerate(
    @Body() dto: BulkModerateReviewsDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.reviews.bulkModerate(dto, user.id);
  }

  @Post(':id/response')
  @RequirePermissions(Permission.APPROVE_REVIEW)
  @ApiRespondReviewDocs()
  respond(
    @Param('id') id: string,
    @Body() dto: RespondToReviewDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.reviews.respond(id, dto, { id: user.id, role: user.role });
  }

  @Post(':id/flag')
  @ApiFlagReviewDocs()
  flag(
    @Param('id') id: string,
    @Body() dto: FlagReviewDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.reviews.flag(id, dto, { id: user.id, role: user.role });
  }

  @Patch('flags/:flagId')
  @RequirePermissions(Permission.APPROVE_REVIEW)
  @ApiResolveFlagDocs()
  resolveFlag(
    @Param('flagId') flagId: string,
    @Body() dto: ResolveFlagDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.reviews.resolveFlag(flagId, dto, user.id);
  }

  @Patch(':id/moderate')
  @RequirePermissions(Permission.APPROVE_REVIEW)
  @ApiModerateReviewDocs()
  moderate(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.reviews.moderate(id, dto, user.id);
  }

  @Patch(':id/theme-tags')
  @RequirePermissions(Permission.EDIT_REVIEW)
  @ApiThemeTagsDocs()
  setThemeTags(@Param('id') id: string, @Body() dto: SetThemeTagsDto) {
    return this.reviews.setThemeTags(id, dto);
  }

  @Patch(':id/feature')
  @RequirePermissions(Permission.EDIT_REVIEW)
  @ApiFeatureReviewDocs()
  setFeatured(@Param('id') id: string, @Body() dto: FeatureReviewDto) {
    return this.reviews.setFeatured(id, dto.isFeatured);
  }

  @Get(':id/history')
  @RequirePermissions(Permission.VIEW_REVIEWS)
  @ApiModerationHistoryDocs()
  history(@Param('id') id: string) {
    return this.reviews.moderationHistory(id);
  }

  @Delete(':id')
  @ApiDeleteReviewDocs()
  remove(
    @Param('id') id: string,
    @Body() dto: DeleteReviewDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.reviews.remove(id, { id: user.id, role: user.role }, dto);
  }

  @Get(':id')
  @Public()
  @ApiGetReviewDocs()
  get(@Param('id') id: string, @AuthenticatedUser() user?: TypedAuthUser) {
    return this.reviews.getById(
      id,
      user ? { id: user.id, role: user.role } : undefined,
    );
  }
}
