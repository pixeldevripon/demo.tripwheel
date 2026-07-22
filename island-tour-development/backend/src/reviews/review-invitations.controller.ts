import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/auth/decorators/public.decorator';
import { ReviewInvitationsService } from './review-invitations.service';
import {
  EnrichReviewDto,
  StartReviewDto,
  SubmitFeedbackDto,
} from './dto/review-invitation.dto';
import {
  ApiEnrichReviewDocs,
  ApiResolveInvitationDocs,
  ApiStartReviewDocs,
  ApiSubmitFeedbackDocs,
} from './reviews.swagger';

/**
 * The tokenized post-tour review flow.
 *
 * Every route is `@Public()` and authenticated by the single-use invitation
 * token in the path, exactly like the cancellation flow: the link arrives in an
 * email, the guest is on a phone, and a sign-in wall between them and step 1
 * would cost more reviews than it protects.
 *
 * The token is the credential, so it is treated like one. Unknown, spent and
 * revoked tokens all return the same 404, and the resolve payload carries only
 * what the page renders - never price, contact details or payment data.
 */
@ApiTags('Reviews')
@Controller('reviews/invitation')
export class ReviewInvitationsController {
  constructor(private readonly invitations: ReviewInvitationsService) {}

  @Get(':token')
  @Public()
  @ApiResolveInvitationDocs()
  resolve(@Param('token') token: string) {
    return this.invitations.resolve(token);
  }

  @Post(':token')
  @Public()
  @ApiStartReviewDocs()
  start(@Param('token') token: string, @Body() dto: StartReviewDto) {
    return this.invitations.start(token, dto);
  }

  @Patch(':token')
  @Public()
  @ApiEnrichReviewDocs()
  enrich(@Param('token') token: string, @Body() dto: EnrichReviewDto) {
    return this.invitations.enrich(token, dto);
  }

  @Post(':token/feedback')
  @Public()
  @ApiSubmitFeedbackDocs()
  feedback(@Param('token') token: string, @Body() dto: SubmitFeedbackDto) {
    return this.invitations.submitPrivateFeedback(token, dto);
  }
}
