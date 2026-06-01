export type Locale = 'en' | 'es' | 'nl' | 'pt' | 'fr' | 'de' | 'zh';

/** All supported locales — order matches the backend `Locale` enum. */
export const ALL_LOCALES: Locale[] = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];

/** Primary locale — used as the fallback and the `x-default` hreflang target. */
export const DEFAULT_LOCALE: Locale = 'en';

/** English labels (admin UI). */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Spanish',
  nl: 'Dutch',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
};

/** Native labels (public locale switcher). */
export const LOCALE_NATIVE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  nl: 'Nederlands',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
};

/** Currency per locale — EUR everywhere except Chinese (USD). */
export const LOCALE_CURRENCY: Record<Locale, 'EUR' | 'USD'> = {
  en: 'EUR',
  es: 'EUR',
  nl: 'EUR',
  pt: 'EUR',
  fr: 'EUR',
  de: 'EUR',
  zh: 'USD',
};

/** Cookie that remembers the visitor's chosen locale. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Path to the flag SVG for a locale (lives in `/public/icons/flags`). */
export function localeFlag(locale: Locale): string {
  return `/icons/flags/${locale}.svg`;
}

/** Type guard — narrows an arbitrary string to a supported `Locale`. */
export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (ALL_LOCALES as string[]).includes(value);
}

/**
 * Prefix an internal path with the active locale.
 * `localizeHref('nl', '/curacao')` → `/nl/curacao`
 * Already-localized or external/anchor hrefs are returned unchanged.
 */
export function localizeHref(locale: Locale, path: string): string {
  if (!path.startsWith('/')) return path; // '#', 'https://…', 'mailto:…'
  const firstSegment = path.split('/')[1];
  if (isLocale(firstSegment)) return path; // already localized
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}
