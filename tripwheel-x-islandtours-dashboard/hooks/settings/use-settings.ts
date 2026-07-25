'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsApi } from '@/lib/api/settings';
import type {
  UpdateCompanyInformationsPayload,
  UpdatePlatformReviewsPayload,
  UpdateIntegrationsConfigurationPayload,
  UpdateMailchimpConfigurationPayload,
  UpdateMollieConfigurationPayload,
  UpdatePaymentProviderPayload,
  UpdateReviewRequestsPayload,
  UpdateSiteInfoPayload,
  UpdateSiteSEOPayload,
  UpdateSocialMediaPayload,
  UpdateStripeConfigurationPayload,
} from '@/types/settings';

export const settingsKeys = {
  all: ['settings'] as const,
  site: () => [...settingsKeys.all, 'site'] as const,
  seo: () => [...settingsKeys.all, 'seo'] as const,
  social: () => [...settingsKeys.all, 'social'] as const,
  company: () => [...settingsKeys.all, 'company'] as const,
  stripe: () => [...settingsKeys.all, 'stripe'] as const,
  mollie: () => [...settingsKeys.all, 'mollie'] as const,
  paymentProvider: () => [...settingsKeys.all, 'payment-provider'] as const,
  mailchimp: () => [...settingsKeys.all, 'mailchimp'] as const,
  integrations: () => [...settingsKeys.all, 'integrations'] as const,
  platformReviews: () => [...settingsKeys.all, 'platform-reviews'] as const,
  reviewRequests: () => [...settingsKeys.all, 'review-requests'] as const,
};

const onError = (err: Error) => toast.error(err.message || 'Failed to save settings');
const saved = () => toast.success('Settings saved');

// ── Site Info ──────────────────────────────────────────────────────────────
export function useSiteInfo() {
  return useQuery({ queryKey: settingsKeys.site(), queryFn: settingsApi.getSiteInfo });
}
export function useUpdateSiteInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSiteInfoPayload) => settingsApi.updateSiteInfo(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.site() });
      saved();
    },
    onError,
  });
}

// ── SEO ──────────────────────────────────────────────────────────────────--
export function useSeo() {
  return useQuery({ queryKey: settingsKeys.seo(), queryFn: settingsApi.getSeo });
}
export function useUpdateSeo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSiteSEOPayload) => settingsApi.updateSeo(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.seo() });
      saved();
    },
    onError,
  });
}

// ── Social Media ─────────────────────────────────────────────────────────--
export function useSocialMedia() {
  return useQuery({ queryKey: settingsKeys.social(), queryFn: settingsApi.getSocialMedia });
}
export function useUpdateSocialMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSocialMediaPayload) => settingsApi.updateSocialMedia(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.social() });
      saved();
    },
    onError,
  });
}

// ── Company Information ─────────────────────────────────────────────────────
export function useCompanyInfo() {
  return useQuery({ queryKey: settingsKeys.company(), queryFn: settingsApi.getCompany });
}
export function useUpdateCompanyInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCompanyInformationsPayload) => settingsApi.updateCompany(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.company() });
      saved();
    },
    onError,
  });
}

// ── Payments: active provider switch ─────────────────────────────────────────
export function usePaymentProvider() {
  return useQuery({
    queryKey: settingsKeys.paymentProvider(),
    queryFn: settingsApi.getPaymentProvider,
  });
}
export function useUpdatePaymentProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePaymentProviderPayload) =>
      settingsApi.updatePaymentProvider(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: settingsKeys.paymentProvider() });
      toast.success(
        `${data.activeProvider === 'MOLLIE' ? 'Mollie' : 'Stripe'} is now taking checkout payments`,
      );
    },
    // Backend rejects a switch to an unconfigured provider with a clear message.
    onError,
  });
}

// ── Payments: Stripe ───────────────────────────────────────────────────────
export function useStripeConfig() {
  return useQuery({ queryKey: settingsKeys.stripe(), queryFn: settingsApi.getStripe });
}
export function useUpdateStripeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateStripeConfigurationPayload) => settingsApi.updateStripe(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.stripe() });
      saved();
    },
    onError,
  });
}

// ── Payments: Mollie ───────────────────────────────────────────────────────
export function useMollieConfig() {
  return useQuery({ queryKey: settingsKeys.mollie(), queryFn: settingsApi.getMollie });
}
export function useUpdateMollieConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMollieConfigurationPayload) => settingsApi.updateMollie(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.mollie() });
      saved();
    },
    onError,
  });
}

// ── Integrations (Meta CAPI + Google Translate) ─────────────────────────────
export function useIntegrationsConfig() {
  return useQuery({
    queryKey: settingsKeys.integrations(),
    queryFn: settingsApi.getIntegrations,
  });
}
export function useUpdateIntegrationsConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateIntegrationsConfigurationPayload) =>
      settingsApi.updateIntegrations(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.integrations() });
      saved();
    },
    onError,
  });
}

// ── Mailchimp ──────────────────────────────────────────────────────────────
export function useMailchimpConfig() {
  return useQuery({ queryKey: settingsKeys.mailchimp(), queryFn: settingsApi.getMailchimp });
}
export function useUpdateMailchimpConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMailchimpConfigurationPayload) => settingsApi.updateMailchimp(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.mailchimp() });
      saved();
    },
    onError,
  });
}

// ── Platform reviews (Trustpilot / Google) ─────────────────────────────────
export function usePlatformReviews() {
  return useQuery({
    queryKey: settingsKeys.platformReviews(),
    queryFn: settingsApi.getPlatformReviews,
  });
}
export function useUpdatePlatformReviews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePlatformReviewsPayload) =>
      settingsApi.updatePlatformReviews(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.platformReviews() });
      saved();
    },
    onError,
  });
}
export function useRefreshPlatformReviews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.refreshPlatformReviews,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: settingsKeys.platformReviews() });
      if (result.ok) {
        toast.success(
          `Fetched ${result.reviewCount ?? '?'} reviews (rating ${result.rating ?? '?'})`,
        );
      } else {
        toast.error(result.error || 'Fetch failed');
      }
    },
    onError,
  });
}

// ── Post-tour review requests (cadence) ────────────────────────────────────
export function useReviewRequests() {
  return useQuery({
    queryKey: settingsKeys.reviewRequests(),
    queryFn: settingsApi.getReviewRequests,
  });
}
export function useUpdateReviewRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateReviewRequestsPayload) =>
      settingsApi.updateReviewRequests(payload),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: settingsKeys.reviewRequests() });
      // The master switch mails real customers, so its state is confirmed
      // explicitly rather than under a generic "Settings saved".
      if (result.enabled) {
        toast.success('Review requests are ON - customers will be emailed');
      } else {
        toast.success('Review requests are OFF - no emails will be sent');
      }
    },
    onError,
  });
}
