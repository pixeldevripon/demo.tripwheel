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
      siteLogoUrl: null,
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

  it('the WhatsApp CTA is THE one green button in the family', () => {
    const { html } = render();
    expect(html).toContain('Chat on WhatsApp');
    expect(html).toContain('background:#16A34A');
    expect(html).toContain('href="https://wa.me/59995612243"');
  });

  it('offers the email and self-serve alternatives', () => {
    const { html } = render();
    expect(html).toContain('Or email everything to sales@island.tours');
    expect(html).toContain('mailto:sales@island.tours');
    expect(html).toContain('Or add your tour yourself');
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

  it('lifecycle footer: opt-out link present', () => {
    const { html } = render();
    expect(html).toContain('Opt out here');
    expect(html).toContain('https://island.tours/unsubscribe/tok-1');
  });
});
