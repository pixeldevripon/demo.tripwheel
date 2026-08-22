import { Locale } from '@/common/constants/locales';
import {
  clearableField,
  mergeTranslation,
  orBase,
  resolveBlocksByPosition,
  resolveFaqLocale,
  resolveLocaleSet,
} from './translation.util';

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

describe('mergeTranslation', () => {
  const t = (locale: Locale, over: Record<string, unknown> = {}) => ({
    locale,
    overview: `${locale} overview`,
    h1Override: `${locale} h1`,
    tags: [`${locale}-tag`],
    isMachineTranslated: locale !== Locale.en,
    ...over,
  });

  it('keeps every field the locale actually has', () => {
    const merged = mergeTranslation([t(Locale.en), t(Locale.nl)], Locale.nl);

    expect(merged).toMatchObject({
      overview: 'nl overview',
      h1Override: 'nl h1',
      tags: ['nl-tag'],
    });
  });

  it('falls back PER FIELD - a cleared field shows English, the rest stays Dutch', () => {
    // Exactly what the Translation Console produces: the row survives with a
    // NULL where the admin cleared it.
    const rows = [t(Locale.en), t(Locale.nl, { overview: null })];

    const merged = mergeTranslation(rows, Locale.nl);

    expect(merged?.overview).toBe('en overview');
    expect(merged?.h1Override).toBe('nl h1');
  });

  it('treats a blank string and an empty array as cleared too', () => {
    const rows = [t(Locale.en), t(Locale.nl, { h1Override: '   ', tags: [] })];

    const merged = mergeTranslation(rows, Locale.nl);

    expect(merged?.h1Override).toBe('en h1');
    expect(merged?.tags).toEqual(['en-tag']);
  });

  it('never lets English overwrite the row-level flag or locale', () => {
    const merged = mergeTranslation(
      [t(Locale.en), t(Locale.nl, { overview: null })],
      Locale.nl,
    );

    expect(merged?.locale).toBe(Locale.nl);
    expect(merged?.isMachineTranslated).toBe(true);
  });

  it('returns the English row when the locale has none at all', () => {
    expect(mergeTranslation([t(Locale.en)], Locale.nl)?.overview).toBe(
      'en overview',
    );
  });

  it('returns the locale row untouched when there is no English to merge', () => {
    const rows = [t(Locale.nl, { overview: null })];

    expect(mergeTranslation(rows, Locale.nl)?.overview).toBeNull();
  });

  it('returns undefined when neither locale is present', () => {
    expect(mergeTranslation([t(Locale.de)], Locale.nl)).toBeUndefined();
  });

  it('asked for English, gives English - no merging with itself', () => {
    const merged = mergeTranslation(
      [t(Locale.en, { overview: null }), t(Locale.nl)],
      Locale.en,
    );

    expect(merged?.overview).toBeNull();
  });
});

describe('clearableField', () => {
  it('accepts a blank in a translated locale - that is how a field is cleared', () => {
    expect(clearableField('  ', Locale.nl, 'The question')).toBe('');
    expect(clearableField(undefined, Locale.nl, 'The question')).toBe('');
  });

  it('trims, so a whitespace-only value is stored as a real clear', () => {
    expect(clearableField('  Hola  ', Locale.nl, 'The question')).toBe('Hola');
  });

  it('refuses a blank in English - nothing is left to fall back to', () => {
    expect(() => clearableField('', Locale.en, 'The question')).toThrow(
      /cannot be empty in English/,
    );
  });

  it('still accepts real English text', () => {
    expect(clearableField('Can I cancel?', Locale.en, 'The question')).toBe(
      'Can I cancel?',
    );
  });
});

describe('resolveGroupedLocale - per-field fallback inside a group', () => {
  const faq = (
    id: string,
    locale: Locale,
    groupId: string,
    over: Record<string, unknown> = {},
  ) => ({
    id,
    locale,
    faqGroupId: groupId,
    displayOrder: 0,
    question: `${locale} question`,
    answer: `${locale} answer`,
    ...over,
  });

  it('shows the English question next to the translated answer when only the question was cleared', () => {
    // The exact Translation-Console shape: NOT NULL columns, so a cleared
    // field is stored as '' and the row survives.
    const rows = [
      faq('en-1', Locale.en, 'g1'),
      faq('nl-1', Locale.nl, 'g1', { question: '' }),
    ];

    const [row] = resolveFaqLocale(rows, Locale.nl);

    expect(row.question).toBe('en question');
    expect(row.answer).toBe('nl answer');
  });

  it('leaves a fully translated group alone', () => {
    const rows = [faq('en-1', Locale.en, 'g1'), faq('nl-1', Locale.nl, 'g1')];

    const [row] = resolveFaqLocale(rows, Locale.nl);

    expect(row.question).toBe('nl question');
    expect(row.answer).toBe('nl answer');
  });

  it('still falls back whole-group when the locale row is missing', () => {
    const rows = [faq('en-1', Locale.en, 'g1')];

    expect(resolveFaqLocale(rows, Locale.nl)[0].question).toBe('en question');
  });

  it('keeps groups independent - one cleared field never touches a sibling', () => {
    const rows = [
      faq('en-1', Locale.en, 'g1'),
      faq('nl-1', Locale.nl, 'g1', { answer: '' }),
      faq('en-2', Locale.en, 'g2', { displayOrder: 1 }),
      faq('nl-2', Locale.nl, 'g2', { displayOrder: 1 }),
    ];

    const [first, second] = resolveFaqLocale(rows, Locale.nl);

    expect(first.answer).toBe('en answer');
    expect(second.answer).toBe('nl answer');
  });
});

describe('resolveBlocksByPosition', () => {
  const block = (
    locale: Locale,
    sectionType: string,
    displayOrder: number,
    over: Record<string, unknown> = {},
  ) => ({
    locale,
    sectionType,
    displayOrder,
    heading: `${locale} heading`,
    body: `${locale} body`,
    ...over,
  });

  it('pairs blocks on (sectionType, displayOrder) and merges per field', () => {
    const rows = [
      block(Locale.en, 'DISCOVER', 0),
      block(Locale.nl, 'DISCOVER', 0, { heading: '' }),
    ];

    const [row] = resolveBlocksByPosition(rows, Locale.nl);

    expect(row.heading).toBe('en heading');
    expect(row.body).toBe('nl body');
  });

  it('shows an untranslated sibling in English instead of hiding it', () => {
    // The old set-level behaviour dropped block #1 entirely as soon as block
    // #0 had a translation.
    const rows = [
      block(Locale.en, 'DISCOVER', 0),
      block(Locale.nl, 'DISCOVER', 0),
      block(Locale.en, 'DISCOVER', 1),
    ];

    const out = resolveBlocksByPosition(rows, Locale.nl);

    expect(out).toHaveLength(2);
    expect(out[0].body).toBe('nl body');
    expect(out[1].body).toBe('en body');
  });
});

describe('orBase', () => {
  it('prefers a real translation', () => {
    expect(orBase('Nederlands', 'English')).toBe('Nederlands');
  });

  it('falls back to the base row for a cleared ("") translation', () => {
    expect(orBase('', 'English')).toBe('English');
    expect(orBase('   ', 'English')).toBe('English');
    expect(orBase(null, 'English')).toBe('English');
    expect(orBase(undefined, 'English')).toBe('English');
  });
});
