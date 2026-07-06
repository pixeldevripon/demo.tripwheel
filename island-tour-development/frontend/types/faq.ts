import type { Locale } from '@/lib/constants/locales';

// Shared FAQ types for every entity that owns FAQs (destination, category, hub,
// collection). A logical FAQ is one faqGroupId whose per-locale rows share the
// same question; the English row is the base and the rest are its translations.

export interface FaqTranslation {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  locale: Locale;
  faqGroupId: string | null;
}

export interface FaqGroup {
  faqGroupId: string;
  displayOrder: number;
  isActive: boolean;
  translations: FaqTranslation[];
}

export interface CreateFaqGroupPayload {
  question: string;
  answer: string;
  displayOrder?: number;
}

export interface UpdateFaqGroupPayload {
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpsertFaqTranslationPayload {
  question: string;
  answer: string;
}
