import {
  OPERATOR_APPROVED_SUBJECT,
  operatorApprovedTemplate,
} from './operator-approved.template';

/** OB-2A - locked copy (onboarding wireframe stage m2a). */
describe('operatorApprovedTemplate', () => {
  const render = (over = {}) =>
    operatorApprovedTemplate({
      firstName: 'Mayra',
      companyName: 'Irie Tours B.V.',
      addTourUrl: 'https://dash.example/trips/new',
      dashboardUrl: 'https://dash.example',
      ...over,
    });

  it('carries the locked subject, greeting and body', () => {
    expect(OPERATOR_APPROVED_SUBJECT).toBe(
      "You're approved. Add your first tour.",
    );
    const { html } = render();
    expect(html).toContain('Good news, Mayra.');
    expect(html).toContain(
      'Irie Tours B.V. is approved on Island Tours. Time for the fun part: your first tour page.',
    );
  });

  it('previews as the wireframe .pre line', () => {
    expect(render().html).toContain('>Your first tour page starts here.</div>');
  });

  it('the company name is PLAIN body text - the wireframe sets no emphasis on it', () => {
    const { html } = render();
    expect(html).not.toContain('font-weight:600;color:#1F2937">Irie Tours');
    expect(html).not.toContain('<b>Irie Tours');
  });

  it('has ONE orange CTA', () => {
    const { html } = render();
    expect(html).toContain('Add your first tour');
    expect(html).toContain('href="https://dash.example/trips/new"');
    expect(html).toContain('bgcolor="#E8611A"');
  });

  it('the dashboard panel sits AFTER the CTA, link on its own line, no trailing period', () => {
    const { html } = render();
    expect(html.indexOf('Add your first tour')).toBeLessThan(
      html.indexOf('Your dashboard, in short'),
    );
    expect(html).toContain(
      'Bookings the moment they land, availability in one tap, your tour pages in one place.<br>',
    );
    expect(html).toContain(
      '<a href="https://dash.example" style="color:#1F2937;font-weight:700">Open your dashboard</a>',
    );
    expect(html).not.toContain('Open your dashboard</a>.');
  });

  it('escapes the operator-supplied company name and first name', () => {
    const { html } = render({
      companyName: '<script>x</script>',
      firstName: '<i>y</i>',
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<i>y</i>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('transactional footer: sign-off present, no opt-out', () => {
    const { html } = render();
    expect(html).toContain('Island Tours. Built by Islanders.');
    expect(html).not.toContain('Opt out here');
  });
});
