import { Locale } from '@/common/constants/locales';
import { resolveFaqLocale, resolveLocaleSet } from './translation.util';

const faq = (
  id: string,
  locale: Locale,
  faqGroupId: string | null,
  displayOrder = 0,
) => ({ id, locale, faqGroupId, displayOrder });

describe('resolveFaqLocale', () => {
  it('prefers the locale row over the English row of the same group', () => {
    const rows = [faq('en-1', Locale.en, 'g1'), faq('nl-1', Locale.nl, 'g1')];

    expect(resolveFaqLocale(rows, Locale.nl).map((r) => r.id)).toEqual([
      'nl-1',
    ]);
  });

  it('is insensitive to row order', () => {
    const rows = [faq('nl-1', Locale.nl, 'g1'), faq('en-1', Locale.en, 'g1')];

    expect(resolveFaqLocale(rows, Locale.nl).map((r) => r.id)).toEqual([
      'nl-1',
    ]);
  });

  it('falls back per group, so a partly-translated page keeps every question', () => {
    const rows = [
      faq('en-1', Locale.en, 'g1', 0),
      faq('nl-1', Locale.nl, 'g1', 0),
      faq('en-2', Locale.en, 'g2', 1), // untranslated
      faq('en-3', Locale.en, 'g3', 2),
      faq('nl-3', Locale.nl, 'g3', 2),
    ];

    expect(resolveFaqLocale(rows, Locale.nl).map((r) => r.id)).toEqual([
      'nl-1',
      'en-2',
      'nl-3',
    ]);
  });

  it('re-sorts by displayOrder after resolution', () => {
    const rows = [
      faq('en-b', Locale.en, 'gb', 2),
      faq('en-a', Locale.en, 'ga', 1),
      faq('nl-a', Locale.nl, 'ga', 1),
    ];

    expect(resolveFaqLocale(rows, Locale.nl).map((r) => r.id)).toEqual([
      'nl-a',
      'en-b',
    ]);
  });

  it('returns every row untouched for English', () => {
    const rows = [faq('en-1', Locale.en, 'g1'), faq('en-2', Locale.en, null)];

    expect(resolveFaqLocale(rows, Locale.en)).toEqual(rows);
  });

  it('falls back as a set for legacy ungrouped rows, never mixing the two locales', () => {
    const rows = [faq('en-1', Locale.en, null), faq('en-2', Locale.en, null)];

    // No Dutch ungrouped rows at all -> the English ones stand in.
    expect(resolveFaqLocale(rows, Locale.nl).map((r) => r.id)).toEqual([
      'en-1',
      'en-2',
    ]);

    // One Dutch ungrouped row -> the English ones drop out entirely, because
    // there is no group key to pair them up with and showing both would
    // duplicate the question in two languages.
    const withDutch = [...rows, faq('nl-1', Locale.nl, null)];
    expect(resolveFaqLocale(withDutch, Locale.nl).map((r) => r.id)).toEqual([
      'nl-1',
    ]);
  });

  it('resolves grouped and ungrouped rows independently in one pass', () => {
    const rows = [
      faq('en-g', Locale.en, 'g1', 0),
      faq('en-u', Locale.en, null, 1),
      faq('nl-u', Locale.nl, null, 1),
    ];

    expect(resolveFaqLocale(rows, Locale.nl).map((r) => r.id)).toEqual([
      'en-g', // grouped, untranslated -> English fallback
      'nl-u', // ungrouped, translated
    ]);
  });

  it('returns an empty list when there is nothing to resolve', () => {
    expect(resolveFaqLocale([], Locale.nl)).toEqual([]);
  });
});

describe('resolveLocaleSet', () => {
  const row = (id: string, locale: Locale) => ({ id, locale });

  it('returns the locale rows when the locale has any', () => {
    const rows = [row('en-1', Locale.en), row('nl-1', Locale.nl)];

    expect(resolveLocaleSet(rows, Locale.nl).map((r) => r.id)).toEqual([
      'nl-1',
    ]);
  });

  it('returns the English rows when the locale has none', () => {
    const rows = [row('en-1', Locale.en), row('en-2', Locale.en)];

    expect(resolveLocaleSet(rows, Locale.nl).map((r) => r.id)).toEqual([
      'en-1',
      'en-2',
    ]);
  });

  it('never returns both locales at once', () => {
    const rows = [
      row('en-1', Locale.en),
      row('en-2', Locale.en),
      row('nl-1', Locale.nl),
    ];

    expect(resolveLocaleSet(rows, Locale.nl).map((r) => r.id)).toEqual([
      'nl-1',
    ]);
  });

  it('returns an empty list when neither locale has rows', () => {
    expect(resolveLocaleSet([row('de-1', Locale.de)], Locale.nl)).toEqual([]);
  });
});
