import {
  OPERATOR_WELCOME_AGREEMENT_SUBJECT,
  operatorWelcomeAgreementTemplate,
} from './operator-welcome-agreement.template';

/** OB-2 - locked copy (onboarding wireframe stage m2). */
describe('operatorWelcomeAgreementTemplate', () => {
  const render = (over = {}) =>
    operatorWelcomeAgreementTemplate({
      firstName: 'Mayra',
      acceptedAt: new Date('2026-07-09T18:32:00.000Z'), // Jul 9 in Curaçao
      agreementVersion: '1.0',
      agreementUrl: 'https://island.tours/operator-agreement',
      supportEmail: 'hello@island.tours',
      whatsappUrl: 'https://wa.me/59995612243',
      siteLogoUrl: null,
      ...over,
    });

  it('carries the locked subject and welcome copy', () => {
    expect(OPERATOR_WELCOME_AGREEMENT_SUBJECT).toBe("You're on Island Tours.");
    const { html } = render();
    expect(html).toContain('Welcome, Mayra.');
    expect(html).toContain(
      'Your operator account is live. You run the tours, we bring the travelers, and that starts with your first tour page.',
    );
  });

  it('renders the registration-check callout verbatim', () => {
    const { html } = render();
    expect(html).toContain("We're checking your registration");
    expect(html).toContain(
      'A quick check of your registration, usually within one business day.',
    );
  });

  it('names the accepted version and date, with the hosted agreement link', () => {
    const { html } = render();
    expect(html).toContain('You accepted version 1.0 on July 9, 2026.');
    expect(html).toContain('href="https://island.tours/operator-agreement"');
    expect(html).toContain('Read your agreement');
  });

  it('degrades without a hosted link or version (D4 pending): no dead anchor', () => {
    const { html } = render({ agreementVersion: null, agreementUrl: null });
    expect(html).toContain(
      'You accepted the Operator Agreement on July 9, 2026.',
    );
    expect(html).not.toContain('Read your agreement');
    expect(html).not.toContain('href="null"');
  });

  it('deliberately has NO add-a-tour CTA (approval gates that page)', () => {
    const { html } = render();
    expect(html).not.toContain('Add your first tour');
  });

  it('carries the questions line with support links and hours', () => {
    const { html } = render();
    expect(html).toContain('Every day, 08:00 to 20:00, Sundays too.');
    expect(html).toContain('mailto:hello@island.tours');
    expect(html).toContain('https://wa.me/59995612243');
  });

  it('escapes the first name (operator-supplied)', () => {
    const { html } = render({ firstName: '<b>x</b>' });
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('is transactional: no opt-out line', () => {
    const { html } = render();
    expect(html).not.toContain('Opt out here');
  });
});
