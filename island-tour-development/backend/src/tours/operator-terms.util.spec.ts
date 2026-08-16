import { resolveLocaleStrings, resolveLocaleText } from './operator-terms.util';

/**
 * Pastel #80 / MCK-20: both operator-conditions carriers are `{locale: value}`
 * JSON maps. Resolution must fall back to EN and must degrade to "no content"
 * on any malformed shape - a bad CMS write may never leak raw JSON to the
 * public checkout.
 */
describe('resolveLocaleStrings (acknowledgment items)', () => {
  const items = {
    en: ['Everyone swimming is at least 1.30 m tall.', 'Nobody is pregnant.'],
    nl: ['Iedereen die zwemt is minstens 1,30 m lang.'],
  };

  it('returns the requested locale', () => {
    expect(resolveLocaleStrings(items, 'nl')).toEqual([
      'Iedereen die zwemt is minstens 1,30 m lang.',
    ]);
  });

  it('falls back to EN for a locale with no items', () => {
    expect(resolveLocaleStrings(items, 'de')).toEqual(items.en);
  });

  it('returns [] for null, arrays and non-string entries', () => {
    expect(resolveLocaleStrings(null, 'en')).toEqual([]);
    expect(resolveLocaleStrings(['not', 'a', 'map'], 'en')).toEqual([]);
    expect(resolveLocaleStrings({ en: [1, 2] }, 'en')).toEqual([]);
    expect(resolveLocaleStrings({ en: 'not-an-array' }, 'en')).toEqual([]);
  });
});

describe('resolveLocaleText (operator document)', () => {
  const doc = { en: '<h4>Safety</h4><p>Follow the crew.</p>', nl: '<p>NL</p>' };

  it('returns the requested locale', () => {
    expect(resolveLocaleText(doc, 'nl')).toBe('<p>NL</p>');
  });

  it('falls back to EN', () => {
    expect(resolveLocaleText(doc, 'fr')).toBe(doc.en);
  });

  it('treats blank and non-string entries as absent', () => {
    expect(resolveLocaleText({ en: '   ' }, 'en')).toBeNull();
    expect(resolveLocaleText({ en: 42 }, 'en')).toBeNull();
    expect(resolveLocaleText(null, 'en')).toBeNull();
  });
});
