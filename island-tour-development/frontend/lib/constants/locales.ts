export type Locale = 'en' | 'es' | 'nl' | 'pt' | 'fr' | 'de' | 'zh';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Spanish',
  nl: 'Dutch',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
};

export const ALL_LOCALES: Locale[] = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];
