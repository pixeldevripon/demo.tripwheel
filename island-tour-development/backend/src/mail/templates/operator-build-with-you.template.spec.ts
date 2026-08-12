import {
  OPERATOR_BUILD_WITH_YOU_SUBJECT,
  operatorBuildWithYouTemplate,
} from './operator-build-with-you.template';

/** OB-4 - locked copy (onboarding wireframe stage m4). */
describe('operatorBuildWithYouTemplate', () => {
  const render = (over = {}) =>
    operatorBuildWithYouTemplate({
      whatsappUrl: 'https://wa.me/59995612243',
      salesEmail: 'sales@island.tours',
      addTourUrl: 'https://dash.example/trips/new',
      optOutUrl: 'https://island.tours/unsubscribe/tok-1',
      ...over,
    });

  it('carries the locked subject and rescue copy', () => {
    expect(OPERATOR_BUILD_WITH_YOU_SUBJECT).toBe("We'll build it with you");
    const { html } = render();
    expect(html).toContain(
      'A first tour page can fall to the bottom of the pile. We know how island days run.',
    );
    expect(html).toContain('you check it, we make it live');
  });

  it('previews as the wireframe .pre line', () => {
    expect(render().html).toContain(
      '>Send your photos and prices on WhatsApp.</div>',
    );
  });

  it('the WhatsApp CTA is THE one green button in the family', () => {
    const { html } = render();
    expect(html).toContain('Chat on WhatsApp');
    expect(html).toContain('bgcolor="#16A34A"');
    expect(html).toContain('href="https://wa.me/59995612243"');
  });

  it('the alternatives are SEPARATE lines with the wireframe 6px/8px tops', () => {
    const { html } = render();
    expect(html).toContain('Or email everything to sales@island.tours');
    expect(html).toContain('mailto:sales@island.tours');
    expect(html).toContain('Or add your tour yourself');
    // Two secondary rows, spaced 13.5px apart - not one <br>-joined line.
    // 13.5, not the 8 this line's `margin-top` asks for: the wireframe's
    // `.e-sec` is a <p> carrying the browser's default `margin-bottom:1em`,
    // and 1em of 13.5px beats an 8px top when the two collapse. Measured in
    // headless Chromium against the wireframe, 2026-08-12.
    expect(html).toContain(
      '<td height="13.5" style="height:13.5px;font-size:0;line-height:0;mso-line-height-rule:exactly">',
    );
    expect(html).not.toContain('sales@island.tours</a><br>');
  });

  it('degrades without WhatsApp: no green button, no dead href', () => {
    const { html } = render({ whatsappUrl: null });
    expect(html).not.toContain('Chat on WhatsApp');
    expect(html).not.toContain('#16A34A');
    expect(html).toContain('Or add your tour yourself');
  });

  it('degrades without a sales mailbox: the email line is dropped', () => {
    const { html } = render({ salesEmail: null });
    expect(html).not.toContain('Or email everything');
    expect(html).toContain('Or add your tour yourself');
  });

  it('lifecycle footer: opt-out present, sign-off absent', () => {
    const { html } = render();
    expect(html).toContain('Opt out here');
    expect(html).toContain('https://island.tours/unsubscribe/tok-1');
    expect(html).not.toContain('Island Tours. Built by Islanders.');
  });
});
