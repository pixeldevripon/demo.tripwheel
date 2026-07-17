/**
 * Locale/Currency unions (D2: types/ imports only types/). The value-level
 * constants (labels, currency maps, guards) stay in lib/constants/locales,
 * which re-exports these types so existing imports keep working.
 */
export type Locale = 'en' | 'es' | 'nl' | 'pt' | 'fr' | 'de' | 'zh';

export type Currency = 'EUR' | 'USD';
