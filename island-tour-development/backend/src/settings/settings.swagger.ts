import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CompanyInformationsResponseDto,
  MailchimpResponseDto,
  MollieConfigurationResponseDto,
  PaymentProviderSettingsResponseDto,
  PublicCompanyInfoResponseDto,
  PublicSiteInfoResponseDto,
  PublicSiteSEOResponseDto,
  PublicSocialMediaResponseDto,
  SiteInfoResponseDto,
  SiteSEOResponseDto,
  SocialMediaResponseDto,
  StripeConfigurationResponseDto,
} from './dto/settings.dto';

const commonErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
    type: BadRequestErrorDto,
  }),
  ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid authentication',
    type: UnauthorizedErrorDto,
  }),
  ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: InternalServerErrorDto,
  }),
];

const adminErrors = [
  ...commonErrors,
  ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (Admin only)',
    type: ForbiddenErrorDto,
  }),
];

// ── Site Info ────────────────────────────────────────────────────────────────

export function ApiGetSiteInfoDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get core site information' }),
    ApiResponse({
      status: 200,
      description: 'Site information retrieved successfully',
      type: SiteInfoResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiGetPublicSiteInfoDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get public site information (no auth)',
      description:
        'Public-safe subset of SiteInfo for the marketing site: logo, favicon, ' +
        'tagline, and the WhatsApp/Instagram feature flags. `whatsappNumber` is ' +
        'null whenever `enableWhatsappChat` is false. Never returns ' +
        'Stripe, Mollie, or Mailchimp configuration.',
    }),
    ApiResponse({
      status: 200,
      description: 'Public site information retrieved successfully',
      type: PublicSiteInfoResponseDto,
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: InternalServerErrorDto,
    }),
  );
}

export function ApiUpdateSiteInfoDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update core site information (Admin only)' }),
    ApiResponse({
      status: 200,
      description: 'Site information updated successfully',
      type: SiteInfoResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiGetPublicSiteSEODocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get public SEO settings (no auth)',
      description:
        'Public-safe subset of SiteSEO for the marketing site: meta, Open ' +
        'Graph, and Twitter tag values plus canonical URL and robots meta. ' +
        'Never returns analytics IDs, verification codes, or robots.txt.',
    }),
    ApiResponse({
      status: 200,
      description: 'Public SEO settings retrieved successfully',
      type: PublicSiteSEOResponseDto,
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: InternalServerErrorDto,
    }),
  );
}

export function ApiGetPublicSocialMediaDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get public social media links (no auth)',
      description:
        'The four public social profile URLs for the marketing site footer.',
    }),
    ApiResponse({
      status: 200,
      description: 'Public social media links retrieved successfully',
      type: PublicSocialMediaResponseDto,
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: InternalServerErrorDto,
    }),
  );
}

export function ApiGetPublicCompanyInfoDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get public company information (no auth)',
      description:
        'Public-safe company/legal details (name, contact, address, VAT) for ' +
        'the marketing site footer and legal pages. Excludes companySize and ' +
        'record timestamps.',
    }),
    ApiResponse({
      status: 200,
      description: 'Public company information retrieved successfully',
      type: PublicCompanyInfoResponseDto,
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: InternalServerErrorDto,
    }),
  );
}

// ── Site SEO ─────────────────────────────────────────────────────────────────

export function ApiGetSiteSEODocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get site SEO configurations' }),
    ApiResponse({
      status: 200,
      description: 'Site SEO configurations retrieved successfully',
      type: SiteSEOResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateSiteSEODocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update site SEO configurations (Admin only)' }),
    ApiResponse({
      status: 200,
      description: 'Site SEO configurations updated successfully',
      type: SiteSEOResponseDto,
    }),
    ...adminErrors,
  );
}

// ── Social Media ─────────────────────────────────────────────────────────────

export function ApiGetSocialMediaDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get social media links' }),
    ApiResponse({
      status: 200,
      description: 'Social media links retrieved successfully',
      type: SocialMediaResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateSocialMediaDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update social media links (Admin only)' }),
    ApiResponse({
      status: 200,
      description: 'Social media links updated successfully',
      type: SocialMediaResponseDto,
    }),
    ...adminErrors,
  );
}

// ── Mailchimp ───────────────────────────────────────────────────────────────

export function ApiGetMailchimpDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get Mailchimp configuration (Admin only)' }),
    ApiResponse({
      status: 200,
      description: 'Mailchimp configuration retrieved successfully',
      type: MailchimpResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateMailchimpDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update Mailchimp configuration (Admin only)' }),
    ApiResponse({
      status: 200,
      description: 'Mailchimp configuration updated successfully',
      type: MailchimpResponseDto,
    }),
    ...adminErrors,
  );
}

// ── Company Informations ─────────────────────────────────────────────────────

export function ApiGetCompanyInformationsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get company information' }),
    ApiResponse({
      status: 200,
      description: 'Company information retrieved successfully',
      type: CompanyInformationsResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateCompanyInformationsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update company information (Admin only)' }),
    ApiResponse({
      status: 200,
      description: 'Company information updated successfully',
      type: CompanyInformationsResponseDto,
    }),
    ...adminErrors,
  );
}

// ── Stripe Configuration ─────────────────────────────────────────────────────

export function ApiGetStripeConfigurationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get Stripe configuration (Admin only)' }),
    ApiResponse({
      status: 200,
      description: 'Stripe configuration retrieved successfully',
      type: StripeConfigurationResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateStripeConfigurationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update Stripe configuration (Admin only)' }),
    ApiResponse({
      status: 200,
      description: 'Stripe configuration updated successfully',
      type: StripeConfigurationResponseDto,
    }),
    ...adminErrors,
  );
}

// ── Integrations Configuration (Meta CAPI + Gemini AI translation) ───────────

export function ApiGetIntegrationsConfigurationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get integrations configuration - secrets masked (Admin only)',
    }),
    ApiResponse({
      status: 200,
      description:
        'Integration config (Meta CAPI + Gemini AI translation); secrets returned masked',
    }),
    ...adminErrors,
  );
}

export function ApiUpdateIntegrationsConfigurationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update integrations configuration (Admin only)',
    }),
    ApiResponse({
      status: 200,
      description:
        'Integration config updated; an omitted/blank secret is left untouched',
    }),
    ...adminErrors,
  );
}

// ── Active payment provider ──────────────────────────────────────────────────

export function ApiGetPaymentProviderDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get the active checkout payment provider (Admin only)',
    }),
    ApiResponse({
      status: 200,
      description: 'Active payment provider retrieved successfully',
      type: PaymentProviderSettingsResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdatePaymentProviderDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Switch the active checkout payment provider (Admin only)',
      description:
        'Rejected (400) when the target provider is missing any credential it ' +
        'needs to charge: Stripe requires the publishable key, secret key and ' +
        'webhook secret; Mollie requires the API key. The message names every ' +
        'gap at once. Save the missing credentials first (PATCH the provider ' +
        'config), then switch. Never retroactive: existing payments keep their ' +
        'own provider for webhooks and refunds.',
    }),
    ApiResponse({
      status: 200,
      description: 'Active payment provider updated successfully',
      type: PaymentProviderSettingsResponseDto,
    }),
    ...adminErrors,
  );
}

// ── Mollie Configuration ─────────────────────────────────────────────────────

export function ApiGetMollieConfigurationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get Mollie configuration (Admin only)' }),
    ApiResponse({
      status: 200,
      description: 'Mollie configuration retrieved successfully',
      type: MollieConfigurationResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateMollieConfigurationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update Mollie configuration (Admin only)' }),
    ApiResponse({
      status: 200,
      description: 'Mollie configuration updated successfully',
      type: MollieConfigurationResponseDto,
    }),
    ...adminErrors,
  );
}

export const ApiGetReviewRequestsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get the post-tour review request schedule',
      description:
        'Cadence for the review invitation: master switch, first-send hour and ' +
        'delay, reminder toggle and interval, give-up window, batch size.',
    }),
    ApiResponse({ status: 200, description: 'ReviewRequestSettings' }),
  );

export const ApiUpdateReviewRequestsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update the post-tour review request schedule',
      description:
        'Every field is optional, so one toggle can be PATCHed alone. ' +
        '`enabled` starts FALSE and is the master switch: while off the job ' +
        'creates no invitations at all, so turning it on cannot fire a backlog ' +
        'of stale emails. Timing is a business decision - the morning-after ' +
        'send is a launch default to A/B test, not a proven optimum.',
    }),
    ApiResponse({ status: 200, description: 'ReviewRequestSettings' }),
    ApiResponse({ status: 400, type: BadRequestErrorDto }),
  );
