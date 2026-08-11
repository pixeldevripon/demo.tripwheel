import {
  OPERATOR_PAGE_STRONGER_SUBJECT,
  operatorPageStrongerTemplate,
} from './operator-page-stronger.template';

/** OB-8 - locked copy (onboarding wireframe stage m8) + the D6 flag. */
describe('operatorPageStrongerTemplate', () => {
  const render = (over = {}) =>
    operatorPageStrongerTemplate({
      includePartnerOffer: true,
      photoShootContactUrl: 'https://wa.me/59995612243',
      toursUrl: 'https://dash.example/trips',
      optOutUrl: 'https://island.tours/unsubscribe/tok-1',
      siteLogoUrl: null,
      ...over,
    });

  it('carries the locked subject and the education-first paragraph', () => {
    expect(OPERATOR_PAGE_STRONGER_SUBJECT).toBe('Make your tour page stronger');
    const { html } = render();
    expect(html).toContain(
      'bright, real photos first (they do most of the work)',
    );
    expect(html).toContain('honest answers to what travelers ask');
  });

  it('with the offer on: Dronebaas block + photo-shoot CTA (wireframe verbatim)', () => {
    const { html } = render();
    expect(html).toContain('Want pro photos?');
    expect(html).toContain(
      'We arrange photo and drone shoots with Dronebaas, our photo partner on the island.',
    );
    expect(html).toContain('Plan a photo shoot');
    expect(html).toContain('href="https://wa.me/59995612243"');
  });

  it('with the offer off (decision D6): no partner named, CTA goes to the tour pages', () => {
    const { html } = render({ includePartnerOffer: false });
    expect(html).not.toContain('Dronebaas');
    expect(html).not.toContain('Plan a photo shoot');
    expect(html).toContain('Open your tour pages');
    expect(html).toContain('href="https://dash.example/trips"');
  });

  it('offer flag without a contact URL degrades like offer-off (no dead CTA)', () => {
    const { html } = render({ photoShootContactUrl: null });
    expect(html).not.toContain('Plan a photo shoot');
    expect(html).toContain('Open your tour pages');
  });

  it('lifecycle footer: opt-out link present', () => {
    const { html } = render();
    expect(html).toContain('Opt out here');
    expect(html).toContain('https://island.tours/unsubscribe/tok-1');
  });
});
