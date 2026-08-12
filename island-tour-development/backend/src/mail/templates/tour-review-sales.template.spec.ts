import {
  tourSubmittedSalesSubject,
  tourSubmittedSalesTemplate,
} from './tour-review.template';

/**
 * INT-2 - locked content (onboarding wireframe stage mint, SECOND card). It
 * lives in tour-review.template.ts beside its auth-family sibling; this spec
 * covers only the operator-family half.
 */
describe('tourSubmittedSalesTemplate (INT-2)', () => {
  const render = (over = {}) =>
    tourSubmittedSalesTemplate({
      tourName: 'Sunset Cruise along Spanish Water',
      operatorName: 'Irie Tours B.V.',
      submittedAt: new Date('2026-07-12T13:14:00.000Z'),
      reviewUrl: 'https://dash.example/trips/t1/review',
      ...over,
    });

  it('subjects and headlines with the tour name', () => {
    expect(tourSubmittedSalesSubject('Sunset Cruise along Spanish Water')).toBe(
      'New tour to review: Sunset Cruise along Spanish Water',
    );
    expect(render().html).toContain(
      'New tour to review: Sunset Cruise along Spanish Water',
    );
  });

  it('uses the wireframe 17px headline override, not the family 21px', () => {
    const { html } = render();
    expect(html).toContain('font-size:17px');
    expect(html).not.toContain('font-size:21px');
  });

  it('wears the internal wordmark suffix', () => {
    expect(render().html).toContain('INTERNAL');
  });

  it('carries the facts table with a submission link in Curaçao time', () => {
    const { html } = render();
    expect(html).toContain('Irie Tours B.V.');
    expect(html).toContain('Jul 12, 2026, 09:14'); // 13:14Z = 09:14 AST
    expect(html).toContain(
      '<a href="https://dash.example/trips/t1/review" style="color:#1F2937">Open the submission</a>',
    );
  });

  it('ONE dark Review button, never the brand orange', () => {
    const { html } = render();
    expect(html).toContain('Review in admin');
    expect(html).toContain('bgcolor="#1F2937"');
    expect(html).not.toContain('bgcolor="#E8611A"');
  });

  it('has NO footer at all', () => {
    const { html } = render();
    expect(html).not.toContain('Island Tours. Built by Islanders.');
    expect(html).not.toContain('ITG B.V.');
    expect(html).not.toContain('Opt out here');
  });

  it('escapes the operator-authored tour name', () => {
    const { html } = render({ tourName: '<img onerror=1>' });
    expect(html).not.toContain('<img onerror=1>');
    expect(html).toContain('&lt;img');
  });
});
