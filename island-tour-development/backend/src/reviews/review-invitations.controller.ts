import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/auth/decorators/public.decorator';
import { ReviewInvitationsService } from './review-invitations.service';
import {
  EnrichReviewDto,
  StartReviewDto,
  SubmitFeedbackDto,
  MAX_REVIEW_PHOTOS,
} from './dto/review-invitation.dto';
import {
  ApiEnrichReviewDocs,
  ApiResolveInvitationDocs,
  ApiStartReviewDocs,
  ApiSubmitFeedbackDocs,
  ApiUploadReviewPhotosDocs,
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
/** 8 MB per photo - a phone shot, not a media-library asset. */
const MAX_REVIEW_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * Images only. The media library accepts every web mimetype because an admin
 * uploads tour video there; this endpoint is anonymous, so anything that is not
 * a photo of a tour has no business being accepted.
 */
const reviewPhotoFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new BadRequestException('Only image files can be attached'), false);
};

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

  /**
   * POST /reviews/invitation/:token/photos  (multipart)
   *
   * BE-16. Anonymous by necessity - the token IS the credential, exactly as for
   * every other write in this flow. Ceilings are deliberately far tighter than
   * the media library's admin upload: images only, 8 MB, and the service caps
   * the total per review. An open unauthenticated endpoint with the library's
   * 100 MB / any-mimetype limits would be free file hosting.
   */
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @Post(':token/photos')
  @Public()
  @UseInterceptors(
    FilesInterceptor('files', MAX_REVIEW_PHOTOS, {
      limits: { fileSize: MAX_REVIEW_PHOTO_BYTES },
      fileFilter: reviewPhotoFilter,
    }),
  )
  @ApiUploadReviewPhotosDocs()
  uploadPhotos(
    @Param('token') token: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.invitations.uploadPhotos(token, files);
  }

  @Post(':token/feedback')
  @Public()
  @ApiSubmitFeedbackDocs()
  feedback(@Param('token') token: string, @Body() dto: SubmitFeedbackDto) {
    return this.invitations.submitPrivateFeedback(token, dto);
  }
}
