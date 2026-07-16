import { buildWhatsappUrl, normalizeWhatsappNumber } from './whatsapp.util';

describe('normalizeWhatsappNumber', () => {
  it.each([
    ['+8801913509868', '8801913509868'],
    ['+5999 123 4567', '59991234567'],
    ['+1 (555) 010-9999', '15550109999'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeWhatsappNumber(input)).toBe(expected);
  });
});

describe('buildWhatsappUrl', () => {
  const NUMBER = '+8801913509868';

  it('builds the master 6.6 deep link', () => {
    expect(buildWhatsappUrl(NUMBER, true)).toBe('https://wa.me/8801913509868');
  });

  it('appends an encoded greeting', () => {
    expect(
      buildWhatsappUrl(NUMBER, true, 'Hi! Question about IT-2026-04821'),
    ).toBe(
      'https://wa.me/8801913509868?text=Hi!%20Question%20about%20IT-2026-04821',
    );
  });

  it('encodes characters that would break the query string', () => {
    const url = buildWhatsappUrl(NUMBER, true, 'A&B=C? 100% sure');
    expect(url).toBe(
      'https://wa.me/8801913509868?text=A%26B%3DC%3F%20100%25%20sure',
    );
  });

  it('omits the text param for an empty or whitespace greeting', () => {
    expect(buildWhatsappUrl(NUMBER, true, '')).toBe(
      'https://wa.me/8801913509868',
    );
    expect(buildWhatsappUrl(NUMBER, true, '   ')).toBe(
      'https://wa.me/8801913509868',
    );
  });

  it('returns null when the chat is disabled', () => {
    expect(buildWhatsappUrl(NUMBER, false)).toBeNull();
    expect(buildWhatsappUrl(NUMBER, null)).toBeNull();
  });

  it('returns null when the number is missing or too short to dial', () => {
    expect(buildWhatsappUrl('', true)).toBeNull();
    expect(buildWhatsappUrl(null, true)).toBeNull();
    expect(buildWhatsappUrl('12345', true)).toBeNull();
  });
});
