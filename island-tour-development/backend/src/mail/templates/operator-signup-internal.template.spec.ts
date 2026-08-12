import {
  operatorSignupInternalSubject,
  operatorSignupInternalTemplate,
} from './operator-signup-internal.template';

/** INT-1 - locked content (onboarding wireframe stage mint, first card). */
describe('operatorSignupInternalTemplate', () => {
  const render = (over = {}) =>
    operatorSignupInternalTemplate({
      operatorName: 'Irie Tours B.V.',
      signatoryName: 'Mayra Martina',
      email: 'mayra@irietours.com',
      phone: '+599 9 561 22 43',
      kvk: '123456',
      acceptedAt: new Date('2026-07-09T18:32:00.000Z'),
      agreementVersion: 'v1.0',
      reviewUrl: 'https://dash.example/tour-operators/op1/edit',
      ...over,
    });

  it('subjects and headlines with the operator name', () => {
    expect(operatorSignupInternalSubject('Irie Tours B.V.')).toBe(
      'New operator: Irie Tours B.V.',
    );
    expect(render().html).toContain('New operator: Irie Tours B.V.');
  });

  it('wears the internal wordmark suffix', () => {
    expect(render().html).toContain('INTERNAL');
  });

  it('carries the facts table in Curaçao time', () => {
    const { html } = render();
    expect(html).toContain('Mayra Martina');
    expect(html).toContain('mayra@irietours.com');
    expect(html).toContain('+599 9 561 22 43');
    expect(html).toContain('KvK Curaçao');
    expect(html).toContain('Jul 9, 2026, 14:32 · Agreement v1.0'); // 18:32Z = 14:32 AST
  });

  it('omits the phone and KvK rows when absent', () => {
    const { html } = render({ phone: null, kvk: null });
    expect(html).not.toContain('Phone / WhatsApp');
    expect(html).not.toContain('KvK Curaçao');
  });

  it('ONE dark Review button, never an approve action', () => {
    const { html } = render();
    expect(html).toContain('Review in admin');
    expect(html).toContain('bgcolor="#1F2937"');
    expect(html).not.toContain('bgcolor="#E8611A"');
    expect(html).not.toMatch(/>\s*Approve/);
  });

  it('has NO footer at all - the wireframe internal cards end at the button', () => {
    const { html, text } = render();
    expect(html).not.toContain('Island Tours. Built by Islanders.');
    expect(html).not.toContain('Opt out here');
    expect(html).not.toContain('ITG B.V.');
    expect(html).not.toContain('border-top:1px solid #EAE7E1');
    expect(text).not.toContain('www.island.tours');
  });

  it('escapes operator-supplied values', () => {
    const { html } = render({ operatorName: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
