import { Locale } from '@prisma/client';
import { negotiateLocale } from './octo-locale';

describe('negotiateLocale', () => {
  it('defaults to English for missing/blank headers', () => {
    expect(negotiateLocale(undefined)).toBe(Locale.en);
    expect(negotiateLocale('')).toBe(Locale.en);
    expect(negotiateLocale('   ')).toBe(Locale.en);
  });

  it('matches the primary subtag (nl-NL → nl)', () => {
    expect(negotiateLocale('nl-NL')).toBe(Locale.nl);
  });

  it('honours q-weight ordering', () => {
    // de wins despite appearing second (q=0.9 > en q=0.8)
    expect(negotiateLocale('en;q=0.8,de;q=0.9')).toBe(Locale.de);
  });

  it('skips unsupported tags and falls through to a supported one', () => {
    expect(negotiateLocale('ja-JP,ko;q=0.9,fr;q=0.5')).toBe(Locale.fr);
  });

  it('falls back to English when nothing is supported', () => {
    expect(negotiateLocale('ja-JP,ko;q=0.9')).toBe(Locale.en);
  });

  it('is case-insensitive', () => {
    expect(negotiateLocale('ZH-Hant')).toBe(Locale.zh);
  });
});
