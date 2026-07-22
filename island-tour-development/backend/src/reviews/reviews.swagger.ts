import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConsumes,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  AdminReviewResponseDto,
  ReviewResponseDto,
  ReviewPhotoUploadResultDto,
  ReviewSummaryDto,
  TranslateReviewResultDto,
} from './dto/review.dto';
import { ReviewInvitationResponseDto } from './dto/review-invitation.dto';

export const ApiCreateReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a review (booking-gated, one per booking)',
      description:
        'The caller must own a confirmed/redeemed booking whose experience date has passed. ' +
        'Starts in PENDING moderation.',
    }),
    ApiCreatedResponse({ type: ReviewResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiListReviewsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List approved reviews for a tour (public, paginated)',
      description:
        'Optional `rating` filters to a single star value, which is what the ' +
        'clickable star distribution chart calls (LD31).',
    }),
    ApiOkResponse({ type: ReviewResponseDto, isArray: true }),
  );

export const ApiReviewSummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Rating summary + star distribution (LD11 cold-start)',
      description:
        "Returns the tour's own rating at ≥3 approved reviews; otherwise the operator's rating " +
        '(only if operator has ≥10 reviews and ≥4.0 avg); otherwise none.',
    }),
    ApiOkResponse({ type: ReviewSummaryDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiMyReviewsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List the caller’s own reviews' }),
    ApiOkResponse({ type: ReviewResponseDto, isArray: true }),
  );

export const ApiModerationQueueDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Moderation queue (oldest-first, default PENDING)',
    }),
    ApiOkResponse({ type: ReviewResponseDto, isArray: true }),
  );

export const ApiGetReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Get a review (approved is public; otherwise owner/operator/admin)',
    }),
    ApiOkResponse({ type: ReviewResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiModerateReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Approve / hold / reject a review (recomputes aggregates)',
      description:
        'Writes an audit row in the SAME transaction. HELD parks a review that ' +
        'needs a second look. A rejection requires a documented POLICY ground - ' +
        'never that the review is negative.',
    }),
    ApiOkResponse({ type: ReviewResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiRespondReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Publish a response (LD37: platform-authored at launch)',
      description:
        'Island Tours authors responses while volume is low; moderated ' +
        'operator-authored responses unlock in phase 4. No editing after ' +
        'publish (E.7) - a second write is a 409, not an overwrite.',
    }),
    ApiConflictResponse({ type: ConflictErrorDto }),
    ApiOkResponse({ type: ReviewResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiDeleteReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Delete a review (author or admin)',
      description:
        'A moderator must supply a documented policy ground; an author deleting ' +
        'their own need not. The audit row is written first and SURVIVES the ' +
        'review, so a removal is always provable.',
    }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiOkResponse({ description: '{ id, deleted: true }' }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiAdminListReviewsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Cross-tour moderation queue (all statuses, filterable)',
      description:
        'Oldest-first by default: a queue is cleared from the bottom, and the ' +
        'oldest pending review is the traveller who has waited longest. Rows ' +
        'carry tour title, operator name, booking reference and open-flag count ' +
        'so a moderator can triage without opening three other screens.',
    }),
    ApiOkResponse({ type: AdminReviewResponseDto, isArray: true }),
  );

export const ApiOperatorListReviewsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "An operator's own reviews (hard-scoped)",
      description:
        'Identical shape to the admin queue, scoped to the calling operator. ' +
        'The scope is applied last, so a supplied operatorId cannot widen it.',
    }),
    ApiOkResponse({ type: AdminReviewResponseDto, isArray: true }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
  );

export const ApiBulkModerateDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Approve / hold / reject many reviews at once',
      description:
        'Each review gets its own audit row carrying its own fromStatus. ' +
        'Aggregates recompute once per affected tour, not once per review.',
    }),
    ApiOkResponse({ description: '{ updated, status }' }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiThemeTagsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Set highlight chips (pre-AI LD29 Tier 3). Admin-only.',
    }),
    ApiOkResponse({ type: ReviewResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiUploadReviewPhotosDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Attach photos to a review via its invitation token (BE-16).',
      description:
        'Multipart `files`. Anonymous by necessity - the single-use token is ' +
        'the credential, as for every other write in this flow. Images only, ' +
        '8 MB each, capped per review across uploads. A spent, revoked or ' +
        'unknown token 404s before anything is stored.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiOkResponse({ type: ReviewPhotoUploadResultDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiTranslateReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Translate a review into the remaining locales (LD32). Admin-only, synchronous.',
      description:
        'Approval already enqueues this. Use the endpoint for a review approved ' +
        'before translation was configured, a source an admin has since edited, ' +
        'or a manual retry after a provider outage. Re-running with an unchanged ' +
        'source writes nothing (the sourceHash cache). 400 when no provider key ' +
        'is configured.',
    }),
    ApiOkResponse({ type: TranslateReviewResultDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiFeatureReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Feature / unfeature a review. Editorial, never tier-linked.',
    }),
    ApiOkResponse({ type: ReviewResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiFlagReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Flag a review for policy review (operator or admin)',
      description:
        'A flag is a REQUEST, never an action: it routes to Island Tours, who ' +
        'decide. Operators have no delete, unpublish or edit anywhere. Sentiment ' +
        'is not a valid ground - the reason enum has no option for it.',
    }),
    ApiCreatedResponse({ description: '{ id, reviewId, reason, status }' }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiResolveFlagDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Resolve or dismiss a flag (Island Tours decides)',
      description:
        "Closes the flag. The review's own moderation status is unchanged - " +
        'removing it is a separate, audited moderation act.',
    }),
    ApiOkResponse({ description: '{ id, reviewId, status, resolvedAt }' }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiModerationHistoryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Full audit trail for one review',
      description:
        'Append-only: every status change and every deletion, with actor, ' +
        'timestamp and documented ground. Survives the review itself.',
    }),
    ApiOkResponse({ description: 'ReviewModerationLog[]' }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

// ── Tokenized post-tour collection flow ──────────────────────────────────────

export const ApiResolveInvitationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Resolve a review invitation token (public, single-use)',
      description:
        'Returns only what the review page renders - tour name, hero image, ' +
        'travel date, guest first name. Unknown, spent and revoked tokens all ' +
        'return the same 404.',
    }),
    ApiOkResponse({ type: ReviewInvitationResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiStartReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Step 1: commit the star rating and spend the token',
      description:
        'The only required step. Commits immediately, so a guest who taps one ' +
        'star and closes the tab has still left a countable review. Creates the ' +
        'review PENDING with its genesis audit row and marks the invitation used.',
    }),
    ApiCreatedResponse({ description: '{ reviewId, rating }' }),
    ApiConflictResponse({ type: ConflictErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiEnrichReviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Steps 2/3/3b: text, photos, guest type (all optional)',
      description:
        'Each field saves independently, so a step persists without the guest ' +
        'reaching the end. Allowed only while the review is still PENDING: once ' +
        'moderated, the approved text is not rewritable from an emailed link.',
    }),
    ApiOkResponse({ description: '{ reviewId, saved: true }' }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
    ApiConflictResponse({ type: ConflictErrorDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );

export const ApiSubmitFeedbackDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Step 4b: private service-recovery message',
      description:
        'Offered ALONGSIDE the neutral platform-review invitation on a low ' +
        'rating, never instead of it - routing only happy customers to a ' +
        'third-party platform is review gating. The public review stands in full ' +
        'whatever the score.',
    }),
    ApiCreatedResponse({ description: '{ received: true }' }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
  );
