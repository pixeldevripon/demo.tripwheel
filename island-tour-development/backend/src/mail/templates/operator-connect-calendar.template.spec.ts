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

  it('previews as the wireframe .pre line, not as its own headline', () => {
    const { html } = render();
    expect(html).toContain('>Manual works. Connected never forgets.</div>');
    expect(html).toContain('>Connect your calendar</div>');
  });

  it('has ONE CTA and the manual-is-fine line BELOW it', () => {
    const { html } = render();
    expect(html).toContain('Connect my calendar');
    expect(html).toContain('href="https://dash.example/calendar"');
    expect(html).toContain(
      'No booking system? Manual is fine. One tap a day keeps everything current.',
    );
    expect(html.indexOf('Connect my calendar')).toBeLessThan(
      html.indexOf('No booking system?'),
    );
  });

  it('lifecycle footer: opt-out present, sign-off absent', () => {
    const { html } = render();
    expect(html).toContain('Opt out here');
    expect(html).toContain('https://island.tours/unsubscribe/tok-1');
    expect(html).not.toContain('Island Tours. Built by Islanders.');
  });
});
