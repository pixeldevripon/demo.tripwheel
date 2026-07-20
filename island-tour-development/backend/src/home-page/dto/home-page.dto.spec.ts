import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateHomePageDto } from './home-page.dto';

/**
 * The homepage row is a singleton rendered on every locale's front page, and
 * `next/image` throws at render on a src it cannot load - so a bad URL here is a
 * site-wide outage, not a broken card. These assert the write-time guard.
 */
async function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateHomePageDto, payload);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('UpdateHomePageDto - media URL validation', () => {
  it('accepts an https URL', async () => {
    expect(
      await errorsFor({ heroImage: 'https://res.cloudinary.com/x/hero.jpg' }),
    ).toEqual([]);
  });

  it('accepts null - clearing a field restores the bundled default', async () => {
    expect(await errorsFor({ heroImage: null })).toEqual([]);
  });

  it('rejects a non-URL string', async () => {
    expect(await errorsFor({ heroImage: 'not a url' })).toEqual(['heroImage']);
  });

  it('rejects a javascript: URL', async () => {
    expect(await errorsFor({ heroImage: 'javascript:alert(1)' })).toEqual([
      'heroImage',
    ]);
  });

  it('rejects plain http', async () => {
    expect(await errorsFor({ heroImage: 'http://example.com/a.jpg' })).toEqual([
      'heroImage',
    ]);
  });

  it('rejects an over-long URL', async () => {
    expect(
      await errorsFor({ heroImage: `https://a.com/${'x'.repeat(2100)}` }),
    ).toEqual(['heroImage']);
  });

  it('validates every editorial image, not just the first', async () => {
    expect(
      await errorsFor({
        editorialImages: ['https://res.cloudinary.com/ok.jpg', 'nope'],
      }),
    ).toEqual(['editorialImages']);
  });

  it('rejects more than the three cards the design renders', async () => {
    expect(
      await errorsFor({
        editorialImages: [
          'https://a.com/1.jpg',
          'https://a.com/2.jpg',
          'https://a.com/3.jpg',
          'https://a.com/4.jpg',
        ],
      }),
    ).toEqual(['editorialImages']);
  });

  it('rejects a bad ogImage', async () => {
    expect(await errorsFor({ ogImage: 'ftp://x/y.png' })).toEqual(['ogImage']);
  });
});
