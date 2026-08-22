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
      walkthroughDuration: null,
      optOutUrl: 'https://island.tours/unsubscribe/tok-1',
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

  it('previews as the wireframe .pre line, not as its own headline', () => {
    const { html } = render();
    expect(html).toContain('>A short walkthrough, start to finish.</div>');
    expect(html).toContain('>Your first tour, step by step</div>');
  });

  it('has ONE CTA - Add your first tour', () => {
    const { html } = render();
    expect(html).toContain('Add your first tour');
    expect(html).toContain('href="https://dash.example/trips/new"');
  });

  it('walkthrough alternates: the Loom card only when a video URL is configured (Q1/Q2)', () => {
    expect(render().html).not.toContain('Watch the walkthrough');
    const withVideo = render({
      walkthroughVideoUrl: 'https://loom.com/share/abc',
      walkthroughDuration: '3 min',
    }).html;
    expect(withVideo).toContain('Watch the walkthrough · 3 min');
    expect(withVideo).toContain('href="https://loom.com/share/abc"');
    // A card, not an embedded player, and never a colour emoji.
    expect(withVideo).toContain('&#9658;');
    expect(withVideo).not.toContain('&#65039;');
  });

  it('the Loom card sits BEFORE the CTA (wireframe block order)', () => {
    const { html } = render({
      walkthroughVideoUrl: 'https://loom.com/share/abc',
      walkthroughDuration: '3 min',
    });
    expect(html.indexOf('Watch the walkthrough')).toBeLessThan(
      html.indexOf('Add your first tour'),
    );
  });

  it('keeps the guide link, as a secondary line, in both variants', () => {
    expect(render().html).toContain('Read the step-by-step guide');
    expect(
      render({ walkthroughVideoUrl: 'https://loom.com/share/abc' }).html,
    ).toContain('Read the step-by-step guide');
    expect(render().html).toContain('text-decoration:underline');
  });

  it('lifecycle footer: opt-out in html and text, and no auth-family lines', () => {
    const { html, text } = render();
    expect(html).toContain('Opt out here');
    expect(html).toContain('https://island.tours/unsubscribe/tok-1');
    expect(text).toContain('https://island.tours/unsubscribe/tok-1');
    expect(html).not.toContain('This is a transactional account email.');
    expect(html).not.toContain('Island Tours. Built by Islanders.');
    expect(html).not.toContain("If the button doesn't work");
  });
});
