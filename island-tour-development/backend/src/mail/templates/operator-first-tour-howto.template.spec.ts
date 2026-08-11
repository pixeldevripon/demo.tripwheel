import {
  OPERATOR_FIRST_TOUR_HOWTO_SUBJECT,
  operatorFirstTourHowtoTemplate,
} from './operator-first-tour-howto.template';

/** OB-3 - locked copy (onboarding wireframe stage m3). */
describe('operatorFirstTourHowtoTemplate', () => {
  const render = (over = {}) =>
    operatorFirstTourHowtoTemplate({
      addTourUrl: 'https://dash.example/trips/new',
      guideUrl: 'https://dash.example/trips/new',
      walkthroughVideoUrl: null,
      optOutUrl: 'https://island.tours/unsubscribe/tok-1',
      siteLogoUrl: null,
      ...over,
    });

  it('carries the locked subject and body copy', () => {
    expect(OPERATOR_FIRST_TOUR_HOWTO_SUBJECT).toBe(
      'Your first tour, step by step',
    );
    const { html } = render();
    expect(html).toContain(
      'Your tour page starts as a short form: your overview, facts, photos, prices, availability, and departure times. You fill it in, we give it a final check, and your page goes live.',
    );
  });

  it('has ONE CTA - Add your first tour', () => {
    const { html } = render();
    expect(html).toContain('Add your first tour');
    expect(html).toContain('href="https://dash.example/trips/new"');
  });

  it('walkthrough alternates: link block only when a video URL is configured (Q1/Q2)', () => {
    expect(render().html).not.toContain('Watch the walkthrough');
    const withVideo = render({
      walkthroughVideoUrl: 'https://loom.com/share/abc',
    }).html;
    expect(withVideo).toContain('Watch the walkthrough');
    expect(withVideo).toContain('href="https://loom.com/share/abc"');
  });

  it('keeps the guide link in both variants', () => {
    expect(render().html).toContain('Read the step-by-step guide');
    expect(
      render({ walkthroughVideoUrl: 'https://loom.com/share/abc' }).html,
    ).toContain('Read the step-by-step guide');
  });

  it('lifecycle footer: opt-out link in html and text', () => {
    const { html, text } = render();
    expect(html).toContain('Opt out here');
    expect(html).toContain('https://island.tours/unsubscribe/tok-1');
    expect(text).toContain('https://island.tours/unsubscribe/tok-1');
    expect(html).not.toContain('This is a transactional account email.');
  });
});
