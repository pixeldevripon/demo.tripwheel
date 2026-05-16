export const SUPPORTED_LOCALES = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';
