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
  CreateReviewDto,
  ListReviewsQueryDto,
  ModerateReviewDto,
  ModerationQueueQueryDto,
  OperatorResponseDto,
  SummaryQueryDto,
} from './dto/review.dto';
import {
  ApiCreateReviewDocs,
  ApiDeleteReviewDocs,
  ApiGetReviewDocs,
  ApiHelpfulReviewDocs,
  ApiListReviewsDocs,
  ApiModerateReviewDocs,
  ApiModerationQueueDocs,
  ApiMyReviewsDocs,
  ApiRespondReviewDocs,
  ApiReviewSummaryDocs,
} from './reviews.swagger';

/**
 * ReviewsController - per-tour, booking-gated reviews with moderation.
 *
 * ## Access
 * - Public: list approved reviews, rating summary, get an approved review, helpful +1.
 * - Authenticated: create (booking owner), own list, operator response (tour owner/admin),
 *   delete (author/admin).
 * - `APPROVE_REVIEW`: moderation queue + approve/reject.
 *
 * Static routes precede `:id` routes (NestJS matches top-to-bottom).
 */
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @ApiCreateReviewDocs()
  create(@Body() dto: CreateReviewDto, @AuthenticatedUser() user: TypedAuthUser) {
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

  @Get('pending')
  @RequirePermissions(Permission.APPROVE_REVIEW)
  @ApiModerationQueueDocs()
  pending(@Query() query: ModerationQueueQueryDto) {
    return this.reviews.moderationQueue(query);
  }

  @Post(':id/helpful')
  @Public()
  @ApiHelpfulReviewDocs()
  helpful(@Param('id') id: string) {
    return this.reviews.markHelpful(id);
  }

  @Post(':id/response')
  @ApiRespondReviewDocs()
  respond(
    @Param('id') id: string,
    @Body() dto: OperatorResponseDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.reviews.respond(id, dto, { id: user.id, role: user.role });
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

  @Delete(':id')
  @ApiDeleteReviewDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.reviews.remove(id, { id: user.id, role: user.role });
  }

  @Get(':id')
  @Public()
  @ApiGetReviewDocs()
  get(@Param('id') id: string, @AuthenticatedUser() user?: TypedAuthUser) {
    return this.reviews.getById(id, user ? { id: user.id, role: user.role } : undefined);
  }
}
