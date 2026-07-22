import type {
  CompanyInformations,
  PlatformReviewsConfig,
  RefreshPlatformReviewsResult,
  UpdatePlatformReviewsPayload,
  MailchimpConfiguration,
  MollieConfiguration,
  ReviewRequestSettings,
  UpdateReviewRequestsPayload,
  SiteInfo,
  SiteSEO,
  SocialMediaSettings,
  StripeConfiguration,
  UpdateCompanyInformationsPayload,
  UpdateMailchimpConfigurationPayload,
  UpdateMollieConfigurationPayload,
  UpdateSiteInfoPayload,
  UpdateSiteSEOPayload,
  UpdateSocialMediaPayload,
  UpdateStripeConfigurationPayload,
} from '@/types/settings';
import { apiFetch } from './fetch';

/** Platform-wide (admin) settings. All endpoints require VIEW/MANAGE_SETTINGS. */
export const settingsApi = {
  // ── Platform reviews (Trustpilot / Google) ────────────────────────────────
  getPlatformReviews(): Promise<PlatformReviewsConfig> {
    return apiFetch<PlatformReviewsConfig>('/platform-reviews/config');
  },
  updatePlatformReviews(
    payload: UpdatePlatformReviewsPayload,
  ): Promise<PlatformReviewsConfig> {
    return apiFetch<PlatformReviewsConfig>('/platform-reviews/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  refreshPlatformReviews(): Promise<RefreshPlatformReviewsResult> {
    return apiFetch<RefreshPlatformReviewsResult>('/platform-reviews/refresh', {
      method: 'POST',
    });
  },

  // ── Site Info ──────────────────────────────────────────────────────────────
  getSiteInfo(): Promise<SiteInfo> {
    return apiFetch<SiteInfo>('/settings/site');
  },
  updateSiteInfo(payload: UpdateSiteInfoPayload): Promise<SiteInfo> {
    return apiFetch<SiteInfo>('/settings/site', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── SEO ──────────────────────────────────────────────────────────────────--
  getSeo(): Promise<SiteSEO> {
    return apiFetch<SiteSEO>('/settings/seo');
  },
  updateSeo(payload: UpdateSiteSEOPayload): Promise<SiteSEO> {
    return apiFetch<SiteSEO>('/settings/seo', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Social Media ─────────────────────────────────────────────────────────--
  getSocialMedia(): Promise<SocialMediaSettings> {
    return apiFetch<SocialMediaSettings>('/settings/social-media');
  },
  updateSocialMedia(payload: UpdateSocialMediaPayload): Promise<SocialMediaSettings> {
    return apiFetch<SocialMediaSettings>('/settings/social-media', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Company Information ─────────────────────────────────────────────────────
  getCompany(): Promise<CompanyInformations> {
    return apiFetch<CompanyInformations>('/settings/company');
  },
  updateCompany(payload: UpdateCompanyInformationsPayload): Promise<CompanyInformations> {
    return apiFetch<CompanyInformations>('/settings/company', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Payments: Stripe ───────────────────────────────────────────────────────
  getStripe(): Promise<StripeConfiguration> {
    return apiFetch<StripeConfiguration>('/settings/payment/stripe');
  },
  updateStripe(payload: UpdateStripeConfigurationPayload): Promise<StripeConfiguration> {
    return apiFetch<StripeConfiguration>('/settings/payment/stripe', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Payments: Mollie ───────────────────────────────────────────────────────
  getMollie(): Promise<MollieConfiguration> {
    return apiFetch<MollieConfiguration>('/settings/payment/mollie');
  },
  updateMollie(payload: UpdateMollieConfigurationPayload): Promise<MollieConfiguration> {
    return apiFetch<MollieConfiguration>('/settings/payment/mollie', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Mailchimp ──────────────────────────────────────────────────────────────
  getMailchimp(): Promise<MailchimpConfiguration> {
    return apiFetch<MailchimpConfiguration>('/settings/mailchimp');
  },
  updateMailchimp(payload: UpdateMailchimpConfigurationPayload): Promise<MailchimpConfiguration> {
    return apiFetch<MailchimpConfiguration>('/settings/mailchimp', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Post-tour review requests (cadence) ───────────────────────────────────
  getReviewRequests(): Promise<ReviewRequestSettings> {
    return apiFetch<ReviewRequestSettings>('/settings/review-requests');
  },
  updateReviewRequests(
    payload: UpdateReviewRequestsPayload,
  ): Promise<ReviewRequestSettings> {
    return apiFetch<ReviewRequestSettings>('/settings/review-requests', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
