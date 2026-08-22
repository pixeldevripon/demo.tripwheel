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

  it('previews as the wireframe .pre line, not as its own headline', () => {
    expect(render().html).toContain(
      '>Your agreement copy is inside. We&#39;re checking your registration.</div>',
    );
  });

  it('renders the registration-check callout verbatim, with no trailing space', () => {
    const { html } = render();
    expect(html).toContain('We&#39;re checking your registration</div>');
    expect(html).toContain(
      'A quick check of your registration, usually within one business day.',
    );
  });

  it('names the accepted version and date, and links the hosted agreement', () => {
    const { html } = render();
    expect(html).toContain(
      'You accepted version 1.0 on July 9, 2026. Your copy always lives at the link below.',
    );
    // Founder decision 2026-08-12 ("add the policy link instead"): the
    // wireframe's "attached as a PDF" clause is deliberately NOT rendered,
    // because D4 never supplied a PDF and no attachment is sent. Promising
    // one in writing, about a contract the operator just accepted, is the
    // failure this asserts against.
    expect(html).not.toContain('attached as a PDF');
    expect(html).toContain('href="https://island.tours/operator-agreement"');
    expect(html).toContain('Read your agreement');
    expect(html).toContain('Your Operator Agreement</div>');
  });

  it('degrades without a hosted link or version (D4 pending): no dead anchor, no PDF claim', () => {
    const { html } = render({ agreementVersion: null, agreementUrl: null });
    expect(html).toContain(
      'You accepted the Operator Agreement on July 9, 2026.',
    );
    expect(html).not.toContain('Read your agreement');
    expect(html).not.toContain('attached as a PDF');
    expect(html).not.toContain('href="null"');
  });

  it('deliberately has NO button at all (approval gates the add-a-tour page)', () => {
    const { html } = render();
    expect(html).not.toContain('Add your first tour');
    // The callout's 4px rule is also #E8611A, so the tell is the button's own
    // padding, which nothing else in the family uses.
    expect(html).not.toContain('padding:13px 22px');
  });

  it('block order: callout, then the agreement panel, then the questions line', () => {
    const { html } = render();
    expect(html.indexOf('We&#39;re checking your registration')).toBeLessThan(
      html.indexOf('Your Operator Agreement'),
    );
    expect(html.indexOf('Your Operator Agreement')).toBeLessThan(
      html.indexOf('Questions?'),
    );
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

  it('transactional footer: sign-off and security line, no opt-out', () => {
    const { html } = render();
    expect(html).toContain('Island Tours. Built by Islanders.');
    expect(html).toContain(
      "We'll never ask for your password, codes, or payment by email.",
    );
    expect(html).not.toContain('Opt out here');
  });
});
