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

  it('previews as the wireframe .pre line - the audit found it had none', () => {
    expect(render().html).toContain('>One quick question.</div>');
  });

  it('is the only stage with NO logo and NO headline', () => {
    const { html } = render();
    expect(html).not.toContain('ISLAND');
    expect(html).not.toContain('font-size:21px');
  });

  it('is near-plain: no buttons, no images', () => {
    const { html } = render();
    expect(html).not.toContain('<img');
    expect(html).not.toContain('bgcolor="#E8611A"');
  });

  it('rides the operator shell: same card, same 14.5px body as the family', () => {
    const { html } = render();
    expect(html).toContain('max-width:600px');
    expect(html).toContain('padding:26px 30px');
    expect(html).toContain('font-size:14.5px');
    expect(html).not.toContain('font-size:15px');
  });

  it('tightens the paragraphs to the wireframe 12px, and zeroes the last', () => {
    const { html } = render();
    const spacers = [...html.matchAll(/<td height="(\d+)"/g)].map((m) =>
      Number(m[1]),
    );
    // three 12px gaps between four paragraphs, then the footer's 22px.
    expect(spacers).toEqual([12, 12, 12, 22]);
  });

  it('the only anchor is the opt-out link', () => {
    const { html } = render();
    const anchors = html.match(/<a /g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(html).toContain('https://island.tours/unsubscribe/tok-1');
  });

  it('the text part reads as a personal note and carries the full footer', () => {
    const { text } = render();
    expect(text).toContain('Hi Mayra,');
    expect(text).toContain('Denley');
    expect(text).toContain(
      "We'll never ask for your password, codes, or payment by email.",
    );
    expect(text).toContain(
      'Island Tours is a service of ITG B.V. (Island Tours Group) · KvK Curaçao 169950',
    );
    expect(text).toContain('Willemstad, Curaçao · www.island.tours');
    expect(text).toContain('https://island.tours/unsubscribe/tok-1');
  });

  it('escapes the first name and survives its absence', () => {
    expect(render({ firstName: '<x>' }).html).toContain('&lt;x&gt;');
    expect(render({ firstName: undefined }).html).toContain('Hi,');
  });
});
