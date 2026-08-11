import {
  OPERATOR_CONNECT_CALENDAR_SUBJECT,
  operatorConnectCalendarTemplate,
} from './operator-connect-calendar.template';

/** OB-7 - locked copy (onboarding wireframe stage m7). */
describe('operatorConnectCalendarTemplate', () => {
  const render = () =>
    operatorConnectCalendarTemplate({
      connectUrl: 'https://dash.example/calendar',
      optOutUrl: 'https://island.tours/unsubscribe/tok-1',
      siteLogoUrl: null,
    });

  it('carries the locked subject and both paragraphs', () => {
    expect(OPERATOR_CONNECT_CALENDAR_SUBJECT).toBe('Connect your calendar');
    const { html } = render();
    expect(html).toContain(
      'Keeping your availability current by hand works fine: one tap a day.',
    );
    expect(html).toContain('closed dates sync themselves');
    expect(html).toContain('Our developer sets it up together with yours');
  });

  it('has ONE CTA and the manual-is-fine line', () => {
    const { html } = render();
    expect(html).toContain('Connect my calendar');
    expect(html).toContain('href="https://dash.example/calendar"');
    expect(html).toContain(
      'No booking system? Manual is fine. One tap a day keeps everything current.',
    );
  });

  it('lifecycle footer: opt-out link present', () => {
    const { html } = render();
    expect(html).toContain('Opt out here');
    expect(html).toContain('https://island.tours/unsubscribe/tok-1');
  });
});
