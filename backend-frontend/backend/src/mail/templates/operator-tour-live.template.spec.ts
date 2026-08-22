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

  it('previews as the wireframe .pre line, not as the headline', () => {
    const { html } = render();
    expect(html).toContain(
      '>See your page, then keep your calendar current.</div>',
    );
    // The subject line is the <title>; it is NOT reused as the headline.
    expect(html).toContain(
      '<title>Your tour is live: Sunset Cruise along Spanish Water</title>',
    );
    expect(html).not.toContain(
      'color:#1F2937">Your tour is live: Sunset Cruise',
    );
  });

  it('has ONE CTA to the live page', () => {
    const { html } = render();
    expect(html).toContain('See your live page');
    expect(html).toContain(
      'href="https://island.tours/en/curacao/sunset-cruise"',
    );
  });

  it('the availability callout sits BELOW the CTA (the audit found it above)', () => {
    const { html } = render();
    expect(html.indexOf('See your live page')).toBeLessThan(
      html.indexOf('Keep your availability current'),
    );
    expect(html.indexOf('Keep your availability current')).toBeLessThan(
      html.indexOf('Open your availability'),
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

  it('transactional footer: sign-off present, no opt-out', () => {
    const { html } = render();
    expect(html).toContain('Island Tours. Built by Islanders.');
    expect(html).not.toContain('Opt out here');
  });
});
