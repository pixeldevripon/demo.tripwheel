import { savedToursTemplate, type SavedTourCard } from './saved-tours.template';

/**
 * "Email me this list" (mck-17). Every branch here is a card that has to
 * degrade rather than break: a tour with no photo, no price, no reviews, or no
 * page at all is still on somebody's saved list and still has to render.
 */
const tour = (over: Partial<SavedTourCard> = {}): SavedTourCard => ({
  title: 'Klein Curacao Day Trip',
  url: 'https://island.tours/en/curacao/klein-curacao-day-trip',
  imageUrl: 'https://cdn.example.com/hero.jpg',
  price: 139,
  currency: 'USD',
  durationMinutes: 540,
  rating: 4.8,
  reviewCount: 214,
  ...over,
});

const render = (tours: SavedTourCard[]) =>
  savedToursTemplate({
    listUrl: 'https://island.tours/en/saved?restore=a,b',
    locale: 'en',
    tours,
    siteLogoUrl: null,
  });

describe('savedToursTemplate', () => {
  it('gives every tour its own link', () => {
    const { html } = render([
      tour(),
      tour({
        title: 'Snorkel Trip',
        url: 'https://island.tours/en/curacao/snorkel',
      }),
    ]);
    expect(html).toContain(
      'href="https://island.tours/en/curacao/klein-curacao-day-trip"',
    );
    expect(html).toContain('href="https://island.tours/en/curacao/snorkel"');
  });

  it('renders a tour with no page as text rather than a dead anchor', () => {
    const { html } = render([tour({ url: null })]);
    expect(html).toContain('Klein Curacao Day Trip');
    expect(html).not.toContain('href="null"');
    expect(html).not.toContain('<a href=""');
  });

  it('formats the price in the shopper currency, and omits the line without one', () => {
    expect(render([tour({ price: 139 })]).html).toContain('$139');
    expect(render([tour({ price: 89.5 })]).html).toContain('$89.50');
    expect(render([tour({ price: null })]).html).not.toContain('from <span');
  });

  it('survives a currency code Intl does not know', () => {
    const { html } = render([tour({ currency: 'NOTACURRENCY' })]);
    expect(html).toContain('139');
  });

  it('omits the rating until the tour has reviews', () => {
    expect(render([tour({ rating: 4.8, reviewCount: 214 })]).html).toContain(
      '(214)',
    );
    const fresh = render([tour({ rating: null, reviewCount: 0 })]).html;
    expect(fresh).not.toContain('(0)');
    expect(fresh).not.toContain('&#9733;');
  });

  it('escapes a tour title rather than letting it inject markup', () => {
    // Operators name their own tours; a title is not trusted markup.
    const { html } = render([tour({ title: '<script>alert(1)</script>' })]);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('caps the list and says how many were left off', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      tour({ title: `Tour ${i}` }),
    );
    const { html } = render(many);
    expect(html).toContain('Tour 11');
    expect(html).not.toContain('Tour 12');
    expect(html).toContain('and 3 more on your list');
  });

  it('carries the restore link in both parts', () => {
    const { html, text } = render([tour()]);
    expect(html).toContain('https://island.tours/en/saved?restore=a,b');
    expect(text).toContain('https://island.tours/en/saved?restore=a,b');
  });

  it('builds a readable plain-text alternative, not a run-on of stripped tags', () => {
    const { text } = render([tour(), tour({ title: 'Snorkel Trip' })]);
    // The shell's own tag-stripping would collapse a table of cards onto one
    // line; the template rebuilds this section as a real list.
    expect(text).toContain('- Klein Curacao Day Trip');
    expect(text).toContain('- Snorkel Trip');
    expect(text.split('\n').length).toBeGreaterThan(5);
  });
});
