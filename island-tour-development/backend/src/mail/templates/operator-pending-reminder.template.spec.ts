import {
  operatorPendingReminderSubject,
  operatorPendingReminderTemplate,
} from './operator-pending-reminder.template';

/** INT1R - the internal-family variant of INT-1 (wireframe stage mint rules). */
describe('operatorPendingReminderTemplate', () => {
  const render = (over = {}) =>
    operatorPendingReminderTemplate({
      operatorName: 'Irie Tours B.V.',
      signatoryName: 'Mayra Martina',
      email: 'mayra@irietours.com',
      phone: '+599 9 561 22 43',
      acceptedAt: new Date('2026-07-09T18:32:00.000Z'),
      reviewUrl: 'https://dash.example/tour-operators/op1/edit',
      ...over,
    });

  it('subjects and headlines with the operator name', () => {
    expect(operatorPendingReminderSubject('Irie Tours B.V.')).toBe(
      'Still pending: Irie Tours B.V.',
    );
    expect(render().html).toContain('Still pending: Irie Tours B.V.');
  });

  it('says why it exists: pending more than 2 business days', () => {
    expect(render().html).toContain('more than 2 business days');
  });

  it('wears the internal wordmark suffix, like INT-1', () => {
    expect(render().html).toContain('INTERNAL');
  });

  it('carries the facts table in Curaçao time', () => {
    const { html } = render();
    expect(html).toContain('Mayra Martina');
    expect(html).toContain('mayra@irietours.com');
    expect(html).toContain('+599 9 561 22 43');
    expect(html).toContain('Jul 9, 2026, 14:32'); // 18:32Z = 14:32 AST
  });

  it('omits the phone row when absent', () => {
    expect(render({ phone: null }).html).not.toContain('Phone / WhatsApp');
  });

  it('internal family: ONE dark Review button, never an approve action', () => {
    const { html } = render();
    expect(html).toContain('Review in admin');
    expect(html).toContain('bgcolor="#1F2937"');
    expect(html).not.toMatch(/>\s*Approve/);
  });

  it('escapes operator-supplied values', () => {
    const { html } = render({ operatorName: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('has NO footer: no opt-out, no sender identity block', () => {
    const { html } = render();
    expect(html).not.toContain('Opt out here');
    expect(html).not.toContain('ITG B.V.');
    expect(html).not.toContain('border-top:1px solid #EAE7E1');
  });

  it('keeps its build-invented never-forward line (no wireframe card exists)', () => {
    expect(render().html).toContain(
      'Internal reminder · sent once per operator. Never forward - it contains contact details.',
    );
  });
});
