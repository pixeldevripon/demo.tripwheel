import {
  operatorTourLiveSubject,
  operatorTourLiveTemplate,
} from './operator-tour-live.template';

/** OB-5 - locked copy (onboarding wireframe stage m5). */
describe('operatorTourLiveTemplate', () => {
  const render = (over = {}) =>
    operatorTourLiveTemplate({
      tourName: 'Sunset Cruise along Spanish Water',
      tourUrl: 'https://island.tours/en/curacao/sunset-cruise',
      availabilityUrl: 'https://dash.example/availability',
      siteLogoUrl: null,
      ...over,
    });

  it('names the tour in the subject and headline', () => {
    expect(operatorTourLiveSubject('Sunset Cruise along Spanish Water')).toBe(
      'Your tour is live: Sunset Cruise along Spanish Water',
    );
    const { html } = render();
    expect(html).toContain('Sunset Cruise along Spanish Water is live.');
    expect(html).toContain(
      'Travelers can book it right now. Take a look at your page, this is what they see.',
    );
  });

  it('has ONE CTA to the live page', () => {
    const { html } = render();
    expect(html).toContain('See your live page');
    expect(html).toContain(
      'href="https://island.tours/en/curacao/sunset-cruise"',
    );
  });

  it('introduces the availability habit once, verbatim', () => {
    const { html } = render();
    expect(html).toContain('Keep your availability current');
    expect(html).toContain('Close that date in the portal, one tap.');
    expect(html).toContain('Open your availability');
    expect(html).toContain('href="https://dash.example/availability"');
  });

  it('escapes the operator-authored tour name', () => {
    const { html } = render({ tourName: '<img onerror=1>' });
    expect(html).not.toContain('<img onerror=1>');
    expect(html).toContain('&lt;img');
  });

  it('is transactional: no opt-out line', () => {
    const { html } = render();
    expect(html).not.toContain('Opt out here');
  });
});
