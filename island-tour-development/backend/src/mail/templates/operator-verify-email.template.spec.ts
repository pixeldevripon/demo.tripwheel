import {
  OPERATOR_VERIFY_EMAIL_SUBJECT,
  operatorVerifyEmailTemplate,
} from './operator-verify-email.template';

/** OB-1 - locked copy (onboarding wireframe stage m1). */
describe('operatorVerifyEmailTemplate', () => {
  const render = () =>
    operatorVerifyEmailTemplate({
      verifyUrl: 'https://api.example/verify/tok',
    });

  it('carries the locked subject, headline and body', () => {
    expect(OPERATOR_VERIFY_EMAIL_SUBJECT).toBe('Confirm your email');
    const { html } = render();
    // Headline is the subject VERBATIM - no trailing period.
    expect(html).toContain('<title>Confirm your email</title>');
    expect(html).toContain('>Confirm your email</div>');
    expect(html).not.toContain('Confirm your email.<');
    expect(html).toContain(
      "Your operator account is almost ready. One click and you're through.",
    );
  });

  it('previews as the wireframe .pre line, not as its own headline', () => {
    expect(render().html).toContain(
      '>One click and you&#39;re through to the next step.</div>',
    );
  });

  it('has ONE CTA and states the 24-hour expiry', () => {
    const { html } = render();
    expect(html).toContain('Confirm my email');
    expect(html).toContain('href="https://api.example/verify/tok"');
    expect(html).toContain(
      "The link works for 24 hours. Didn't sign up? You can ignore this email.",
    );
  });

  it('is single-purpose: no dashboard tour, no opt-out, no sign-off', () => {
    const { html } = render();
    expect(html).not.toContain('Opt out here');
    expect(html).not.toContain('Built by Islanders');
    expect(html).not.toContain("If the button doesn't work");
  });

  it('verification footer: identity lines only', () => {
    const { html } = render();
    expect(html).toContain(
      'Island Tours is a service of ITG B.V. (Island Tours Group) · KvK Curaçao 169950',
    );
    expect(html).toContain('Willemstad, Curaçao · www.island.tours');
    expect(html).not.toContain(
      "We'll never ask for your password, codes, or payment by email.",
    );
  });
});
