'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsApi } from '@/lib/api/settings';
import type {
  UpdateCompanyInformationsPayload,
  UpdateMailchimpConfigurationPayload,
  UpdateMollieConfigurationPayload,
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
  mailchimp: () => [...settingsKeys.all, 'mailchimp'] as const,
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
