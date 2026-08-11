import {
  OPERATOR_CHECK_IN_SUBJECT,
  operatorCheckInTemplate,
} from './operator-check-in.template';

/** OB-6 - locked copy (onboarding wireframe stage m6): near-plain, personal. */
describe('operatorCheckInTemplate', () => {
  const render = (over = {}) =>
    operatorCheckInTemplate({
      firstName: 'Mayra',
      optOutUrl: 'https://island.tours/unsubscribe/tok-1',
      ...over,
    });

  it('carries the locked subject and the founder copy verbatim', () => {
    expect(OPERATOR_CHECK_IN_SUBJECT).toBe("How's it going?");
    const { html } = render();
    expect(html).toContain('Hi Mayra,');
    expect(html).toContain(
      "Denley here, founder of Island Tours. One quick question: what's the one thing we could do better for you as an operator?",
    );
    expect(html).toContain(
      "Hit reply, it lands in my inbox. WhatsApp works too, that's often faster.",
    );
  });

  it('is near-plain: no buttons, no images, no logo bar', () => {
    const { html } = render();
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/background:#E8611A/);
    expect(html).not.toContain('ISLAND');
  });

  it('the only anchor is the opt-out link', () => {
    const { html } = render();
    const anchors = html.match(/<a /g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(html).toContain('https://island.tours/unsubscribe/tok-1');
  });

  it('the text part reads as a personal note and keeps the opt-out', () => {
    const { text } = render();
    expect(text).toContain('Hi Mayra,');
    expect(text).toContain('Denley');
    expect(text).toContain('https://island.tours/unsubscribe/tok-1');
  });

  it('escapes the first name and survives its absence', () => {
    expect(render({ firstName: '<x>' }).html).toContain('&lt;x&gt;');
    expect(render({ firstName: undefined }).html).toContain('Hi,');
  });
});
