import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
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
import { Permission, Role } from '@prisma/client';
import { Public } from '@/auth/decorators/public.decorator';
import {
  CreateOperatorDto,
  DecideVerificationDto,
  OnboardOperatorDto,
  OperatorPublicTermsQueryDto,
  OperatorQueryDto,
  UpdateOperatorCompanyInfoDto,
  UpdateOperatorDto,
  UpdateOperatorMollieConfigDto,
  UpdateOperatorPaymentProviderDto,
  UpdateOperatorSocialMediaDto,
  UpdateOperatorStripeConfigDto,
} from './dto/operator.dto';
import { OperatorsService } from './operators.service';
import {
  ApiCreateOperatorDocs,
  ApiDecideVerificationDocs,
  ApiDeleteOperatorDocs,
  ApiGetAllOperatorsDocs,
  ApiGetOperatorByIdDocs,
  ApiGetOperatorPublicTermsDocs,
  ApiGetOperatorCompanyInfoDocs,
  ApiGetOperatorMollieConfigDocs,
  ApiGetOperatorPaymentProviderDocs,
  ApiGetOperatorSocialMediaDocs,
  ApiGetOperatorStripeConfigDocs,
  ApiOnboardOperatorDocs,
  ApiUpdateOperatorCompanyInfoDocs,
  ApiUpdateOperatorDocs,
  ApiUpdateOperatorMollieConfigDocs,
  ApiUpdateOperatorPaymentProviderDocs,
  ApiUpdateOperatorSocialMediaDocs,
  ApiListOperatorEmailsDocs,
  ApiResendOperatorEmailDocs,
  ApiUpdateOperatorStripeConfigDocs,
} from './operators.swagger';
import { EmailLogService } from '@/mail/email-log.service';
import { OnboardingEmailsService } from '@/mail/onboarding-emails.service';

@ApiTags('Operators')
@Controller('operators')
export class OperatorsController {
  constructor(
    private readonly operatorsService: OperatorsService,
    private readonly emailLog: EmailLogService,
    private readonly onboardingEmails: OnboardingEmailsService,
  ) {}

  // ── Core Operator CRUD ─────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiCreateOperatorDocs()
  create(@Body() dto: CreateOperatorDto) {
    return this.operatorsService.create(dto);
  }

  @Post('onboarding')
  @RequirePermissions(Permission.EDIT_OPERATOR_PROFILE)
  @ApiOnboardOperatorDocs()
  onboard(
    @Body() dto: OnboardOperatorDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.onboard(user.id, dto);
  }

  @Get()
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiGetAllOperatorsDocs()
  findAll(@Query() query: OperatorQueryDto) {
    return this.operatorsService.findAll(query);
  }

  /**
   * GET /operators/slug/:slug/terms - the canonical conditions read
   * (Pastel #80 / MCK-20 §3). Public: the /operators/{slug}/conditions page,
   * the tour-page reading layer and the confirmation email all render it.
   * Static segment first, so it can never shadow (or be shadowed by) `:id`.
   */
  @Get('slug/:slug/terms')
  @Public()
  @ApiGetOperatorPublicTermsDocs()
  getPublicTerms(
    @Param('slug') slug: string,
    @Query() query: OperatorPublicTermsQueryDto,
  ) {
    return this.operatorsService.getPublicTermsBySlug(slug, query.locale);
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_OPERATOR_PROFILE)
  @ApiGetOperatorByIdDocs()
  findOne(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.operatorsService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiUpdateOperatorDocs()
  update(@Param('id') id: string, @Body() dto: UpdateOperatorDto) {
    return this.operatorsService.update(id, dto);
  }

  @Post(':id/verification')
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiDecideVerificationDocs()
  decideVerification(
    @Param('id') id: string,
    @Body() dto: DecideVerificationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.decideVerification(id, dto, user.id);
  }

  // Email timeline (send-log rows, WP-A) - the dashboard onboarding surface.
  // MANAGE_OPERATORS per the pinned contract (plan §2.5); rows come from the
  // global send log (MailModule), not OperatorsService.
  @Get(':id/emails')
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiListOperatorEmailsDocs()
  listEmails(@Param('id') id: string) {
    return this.emailLog.listForOperator(id);
  }

  // Admin resend for the onboarding set (WP-D, plan §2.5): writes a
  // `#resend-{n}` send-log row and returns it. OB set + OB-2A only - the
  // service 400s anything else; suppression/window/cap are deliberately NOT
  // re-checked (an explicit admin action is its own authorization).
  @Post(':id/emails/:templateKey/resend')
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiResendOperatorEmailDocs()
  resendEmail(
    @Param('id') id: string,
    @Param('templateKey') templateKey: string,
  ) {
    return this.onboardingEmails.resend(id, templateKey);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiDeleteOperatorDocs()
  remove(@Param('id') id: string) {
    return this.operatorsService.remove(id);
  }

  // ── Company Information ────────────────────────────────────────────────────

  @Get(':id/company-info')
  @RequirePermissions(Permission.VIEW_OPERATOR_PROFILE)
  @ApiGetOperatorCompanyInfoDocs()
  getCompanyInfo(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.getCompanyInfo(id, user.id, user.role);
  }

  @Patch(':id/company-info')
  @RequirePermissions(Permission.EDIT_OPERATOR_PROFILE)
  @ApiUpdateOperatorCompanyInfoDocs()
  updateCompanyInfo(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorCompanyInfoDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.updateCompanyInfo(id, user.id, user.role, dto);
  }

  // ── Social Media ───────────────────────────────────────────────────────────

  @Get(':id/social-media')
  @RequirePermissions(Permission.VIEW_OPERATOR_PROFILE)
  @ApiGetOperatorSocialMediaDocs()
  getSocialMedia(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.getSocialMedia(id, user.id, user.role);
  }

  @Patch(':id/social-media')
  @RequirePermissions(Permission.EDIT_OPERATOR_PROFILE)
  @ApiUpdateOperatorSocialMediaDocs()
  updateSocialMedia(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorSocialMediaDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.updateSocialMedia(id, user.id, user.role, dto);
  }

  // ── Stripe Configuration ───────────────────────────────────────────────────

  @Get(':id/stripe-config')
  @RequirePermissions(Permission.MANAGE_OPERATOR_PAYMENTS)
  @ApiGetOperatorStripeConfigDocs()
  getStripeConfig(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.getStripeConfig(id, user.id, user.role);
  }

  @Patch(':id/stripe-config')
  @RequirePermissions(Permission.MANAGE_OPERATOR_PAYMENTS)
  @ApiUpdateOperatorStripeConfigDocs()
  updateStripeConfig(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorStripeConfigDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.updateStripeConfig(
      id,
      user.id,
      user.role,
      dto,
    );
  }

  // ── Active payment provider (single switch, mirrors platform settings) ─────

  @Get(':id/payment-provider')
  @RequirePermissions(Permission.MANAGE_OPERATOR_PAYMENTS)
  @ApiGetOperatorPaymentProviderDocs()
  getPaymentProvider(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.getPaymentProvider(id, user.id, user.role);
  }

  @Patch(':id/payment-provider')
  @RequirePermissions(Permission.MANAGE_OPERATOR_PAYMENTS)
  @ApiUpdateOperatorPaymentProviderDocs()
  updatePaymentProvider(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorPaymentProviderDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.updatePaymentProvider(
      id,
      user.id,
      user.role,
      dto,
    );
  }

  // ── Mollie Configuration ───────────────────────────────────────────────────

  @Get(':id/mollie-config')
  @RequirePermissions(Permission.MANAGE_OPERATOR_PAYMENTS)
  @ApiGetOperatorMollieConfigDocs()
  getMollieConfig(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.getMollieConfig(id, user.id, user.role);
  }

  @Patch(':id/mollie-config')
  @RequirePermissions(Permission.MANAGE_OPERATOR_PAYMENTS)
  @ApiUpdateOperatorMollieConfigDocs()
  updateMollieConfig(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorMollieConfigDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.updateMollieConfig(
      id,
      user.id,
      user.role,
      dto,
    );
  }
}
