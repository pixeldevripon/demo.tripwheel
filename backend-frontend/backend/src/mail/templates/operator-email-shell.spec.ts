import {
  operatorEmailShell,
  operatorInlineLink,
  type OperatorEmailBlock,
  type OperatorEmailFooter,
} from './operator-email-shell';

/**
 * The operator design system itself. The per-email specs assert COPY; this one
 * asserts the two things the wireframe audit found broken across the family -
 * the footer variants and the block ORDER - plus the email-client translations
 * that are invisible until an Outlook renders them.
 */
describe('operatorEmailShell', () => {
  const render = (
    blocks: OperatorEmailBlock[],
    footer: OperatorEmailFooter = { variant: 'none' },
  ) =>
    operatorEmailShell({
      title: 'Subject line',
      preheader: 'Preview line',
      blocks,
      footer,
    });

  // ── The card ───────────────────────────────────────────────────────────────

  it('draws the wireframe card: 600px on #EDEFF2, one uniform padding box', () => {
    const { html } = render([{ kind: 'headline', text: 'Hello' }]);
    expect(html).toContain('background:#EDEFF2');
    expect(html).toContain('max-width:600px');
    expect(html).toContain('border:1px solid #EAE7E1');
    expect(html).toContain('border-radius:14px');
    expect(html).toContain('padding:26px 30px');
  });

  it('the preheader is its own line, distinct from the title and the headline', () => {
    const { html } = operatorEmailShell({
      title: 'Subject line',
      preheader: 'Preview line',
      blocks: [{ kind: 'headline', text: 'Headline text' }],
      footer: { variant: 'none' },
    });
    expect(html).toContain('<title>Subject line</title>');
    expect(html).toContain('>Preview line</div>');
    expect(html).toContain('>Headline text</div>');
    // The regression this prop exists to kill: one string in all three slots.
    expect(html).not.toContain('>Subject line</div>');
  });

  it('never ships the auth family blocks the operator wireframe drops', () => {
    const { html } = render(
      [{ kind: 'button', label: 'Go', url: 'https://x/y' }],
      { variant: 'transactional' },
    );
    expect(html).not.toContain("If the button doesn't work");
    expect(html).not.toContain('This is a transactional account email.');
    // No image-logo variant: the operator wordmark is text.
    expect(html).not.toContain('<img');
  });

  // ── Block order ────────────────────────────────────────────────────────────

  it('renders blocks in the order given - callout after the CTA (OB-5)', () => {
    const { html } = render([
      { kind: 'button', label: 'See your live page', url: 'https://x/live' },
      { kind: 'callout', heading: 'Habit', bodyHtml: 'Body', marginTop: 16 },
    ]);
    expect(html.indexOf('See your live page')).toBeLessThan(
      html.indexOf('Habit'),
    );
  });

  it('renders blocks in the order given - quiet panel before the CTA (OB-8)', () => {
    const { html } = render([
      { kind: 'quiet', heading: 'Offer', bodyHtml: 'Body', spacing: 'below' },
      { kind: 'button', label: 'Plan a photo shoot', url: 'https://x/shoot' },
    ]);
    expect(html.indexOf('Offer')).toBeLessThan(
      html.indexOf('Plan a photo shoot'),
    );
  });

  it('the same blocks in the other order produce different HTML', () => {
    const a = render([
      { kind: 'button', label: 'Go', url: 'https://x/y' },
      { kind: 'muted', html: 'Note' },
    ]).html;
    const b = render([
      { kind: 'muted', html: 'Note' },
      { kind: 'button', label: 'Go', url: 'https://x/y' },
    ]).html;
    expect(a).not.toBe(b);
  });

  // ── Vertical rhythm ────────────────────────────────────────────────────────

  const spacers = (html: string) =>
    [
      ...html.matchAll(
        /<td height="([\d.]+)" style="height:[\d.]+px;font-size:0/g,
      ),
    ].map((m) => Number(m[1]));

  /**
   * The LAST block's bottom margin survives into the card's padding — CSS
   * margins do not collapse against a padding edge — so a footerless render
   * ends with one extra spacer. `render()` defaults to the internal family's
   * `variant: 'none'`, which is exactly that case (INT-1 and INT-2 lost 11px
   * under their CTA before this was modelled).
   */

  it('collapses adjacent block margins, the way the wireframe CSS does', () => {
    // paragraph (margin-bottom 16) beside a callout (margin-top 0) = 16, not 16+0
    // stacked on anything else.
    const { html } = render([
      { kind: 'paragraph', html: 'One' },
      { kind: 'callout', heading: 'H', bodyHtml: 'B' },
    ]);
    // 16 between the two, then the callout's own 16 before the card edge.
    expect(spacers(html)).toEqual([16, 16]);
  });

  it('SUMS margins around the CTA, which is inline-block and cannot collapse', () => {
    // OB-5: button (margin-bottom 10) + callout (margin-top 16) = 26px.
    const { html } = render([
      { kind: 'button', label: 'Go', url: 'https://x/y' },
      { kind: 'callout', heading: 'H', bodyHtml: 'B', marginTop: 16 },
    ]);
    // 10 + 16 summed around the inline-block CTA, then the callout's trailing 16.
    expect(spacers(html)).toEqual([26, 16]);
  });

  it('honours the per-stage margin overrides (OB-6 paragraphs, OB-4 links)', () => {
    const tight = render([
      { kind: 'paragraph', html: 'One', marginBottom: 12 },
      { kind: 'paragraph', html: 'Two', marginBottom: 0 },
    ]);
    // OB-6's last paragraph sets margin-bottom 0, so nothing trails it.
    expect(spacers(tight.html)).toEqual([12]);

    const links = render([
      { kind: 'secondary', label: 'A', url: 'https://x/a', marginTop: 6 },
      { kind: 'secondary', label: 'B', url: 'https://x/b', marginTop: 8 },
    ]);
    // OB-4: the second link's 8px top loses to the first's 13.5px bottom — the
    // browser default `margin-bottom:1em` on the wireframe's `<p class="e-sec">`,
    // which measures 13.5px at 13.5px. Then 13.5px again before the card edge.
    expect(spacers(links.html)).toEqual([13.5, 13.5]);
  });

  it('separates the footer with the wireframe 22px, collapsed against the last block', () => {
    const { html } = render([{ kind: 'muted', html: 'Note' }], {
      variant: 'transactional',
    });
    expect(spacers(html)).toEqual([22]);
    expect(html).toContain('border-top:1px solid #EAE7E1');
    expect(html).toContain('padding-top:14px');
  });

  // ── Footer variants ────────────────────────────────────────────────────────

  const SIGNOFF = 'Island Tours. Built by Islanders.';
  const SECURITY =
    "We'll never ask for your password, codes, or payment by email.";
  const ENTITY =
    'Island Tours is a service of ITG B.V. (Island Tours Group) · KvK Curaçao 169950';
  const ADDRESS = 'Willemstad, Curaçao · www.island.tours';

  const body: OperatorEmailBlock[] = [{ kind: 'paragraph', html: 'Body' }];

  it('verification (OB-1): identity lines only', () => {
    const { html, text } = render(body, { variant: 'verification' });
    expect(html).toContain(ENTITY);
    expect(html).toContain(ADDRESS);
    expect(html).not.toContain(SIGNOFF);
    expect(html).not.toContain(SECURITY);
    expect(html).not.toContain('Opt out here');
    expect(text).toContain(ENTITY);
    expect(text).not.toContain(SIGNOFF);
  });

  it('transactional (OB-2/2A/5): sign-off, security, identity - never an opt-out', () => {
    const { html, text } = render(body, { variant: 'transactional' });
    expect(html).toContain(SIGNOFF);
    expect(html).toContain(SECURITY);
    expect(html).toContain(ENTITY);
    expect(html).toContain(ADDRESS);
    expect(html).not.toContain('Opt out here');
    expect(text).toContain(SIGNOFF);
    expect(text).toContain(SECURITY);
  });

  it('lifecycle (OB-3/4/6/7/8): opt-out instead of the sign-off - they never co-occur', () => {
    const { html, text } = render(body, {
      variant: 'lifecycle',
      optOutUrl: 'https://island.tours/e/unsub/tok-1',
    });
    expect(html).not.toContain(SIGNOFF);
    expect(html).toContain(SECURITY);
    expect(html).toContain('Prefer no setup emails?');
    expect(html).toContain('href="https://island.tours/e/unsub/tok-1"');
    expect(text).toContain(
      'Prefer no setup emails? Opt out here: https://island.tours/e/unsub/tok-1',
    );
    expect(text).not.toContain(SIGNOFF);
  });

  it('none (INT-1/INT-2): no footer element at all', () => {
    const { html, text } = render(body, { variant: 'none' });
    expect(html).not.toContain(ENTITY);
    expect(html).not.toContain(SECURITY);
    expect(html).not.toContain('border-top:1px solid #EAE7E1');
    expect(text).not.toContain(ADDRESS);
  });

  it('keeps the identity lines adjacent and in order, immediately before the opt-out', () => {
    const { html } = render(body, {
      variant: 'lifecycle',
      optOutUrl: 'https://island.tours/e/unsub/tok-1',
    });
    expect(html).toContain(
      `${ENTITY}<br>${ADDRESS}<br>Prefer no setup emails?`,
    );
  });

  // ── Email-client translations ──────────────────────────────────────────────

  it('the CTA is a table button: fill on the td, padding on the td', () => {
    const { html } = render([
      { kind: 'button', label: 'Confirm my email', url: 'https://x/verify' },
    ]);
    expect(html).toContain('<td bgcolor="#E8611A"');
    expect(html).toContain('padding:13px 22px');
    // The three fills the family allows, and only those.
    expect(
      render([
        { kind: 'button', label: 'Chat', url: 'https://x', tone: 'green' },
      ]).html,
    ).toContain('bgcolor="#16A34A"');
    expect(
      render([
        { kind: 'button', label: 'Review', url: 'https://x', tone: 'dark' },
      ]).html,
    ).toContain('bgcolor="#1F2937"');
  });

  it("the callout's left rule is a table cell, not a one-sided border", () => {
    const { html } = render([
      { kind: 'callout', heading: 'Heading', bodyHtml: 'Body' },
    ]);
    expect(html).not.toContain('border-left');
    expect(html).toContain('<td width="4" bgcolor="#E8611A"');
    expect(html).toContain('bgcolor="#FBF1EA"');
  });

  it('the Loom card is a table with a solid fallback fill and a TEXT play glyph', () => {
    const { html } = render([
      { kind: 'loom', url: 'https://loom.com/share/abc', duration: '3 min' },
    ]);
    expect(html).toContain('bgcolor="#1B5E7E"'); // the gradient's 60% stop
    expect(html).toContain('linear-gradient(150deg,#2E86AB 0%');
    expect(html).toContain('line-height:52px'); // the chip centres by line-height
    expect(html).toContain('&#9658;');
    // Emoji are forbidden by the wireframe's design constants.
    expect(html).not.toContain('&#9654;');
    expect(html).not.toContain('&#65039;');
    expect(html).toContain('Watch the walkthrough · 3 min');
  });

  it('drops the Loom caption separator when the duration merge field is unset', () => {
    const { html } = render([
      { kind: 'loom', url: 'https://loom.com/share/abc', duration: '' },
    ]);
    expect(html).toContain('>Watch the walkthrough<');
  });

  it('the internal logo variant carries the wireframe suffix', () => {
    expect(render([{ kind: 'logo' }]).html).not.toContain('INTERNAL');
    const internal = render([{ kind: 'logo', variant: 'internal' }]).html;
    expect(internal).toContain(
      'ISLAND <span style="color:#E8611A">TOURS</span>',
    );
    expect(internal).toContain('INTERNAL');
  });

  it('INT-2 can shrink the headline to the wireframe 17px', () => {
    expect(render([{ kind: 'headline', text: 'X' }]).html).toContain(
      'font-size:21px',
    );
    expect(
      render([{ kind: 'headline', text: 'X', size: 'compact' }]).html,
    ).toContain('font-size:17px');
  });

  // ── Escaping ───────────────────────────────────────────────────────────────

  it('escapes every plain-text field and every URL', () => {
    const { html } = render(
      [
        { kind: 'headline', text: '<script>x</script>' },
        { kind: 'button', label: '<b>go</b>', url: 'https://x/"onmouseover=1' },
        { kind: 'facts', rows: [{ label: '<i>l</i>', valueHtml: 'v' }] },
      ],
      { variant: 'lifecycle', optOutUrl: 'https://x/"evil' },
    );
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>go</b>');
    expect(html).not.toContain('<i>l</i>');
    expect(html).not.toContain('href="https://x/"onmouseover=1"');
    expect(html).toContain('&quot;onmouseover=1');
    expect(html).toContain('&quot;evil');
  });

  it('operatorInlineLink escapes both halves and carries the two wireframe tones', () => {
    expect(operatorInlineLink('https://x/a', 'Read your agreement')).toContain(
      'color:#1F2937;font-weight:700',
    );
    expect(operatorInlineLink('https://x/a', 'Read', 'callout')).toContain(
      'color:#9a4a16;font-weight:700',
    );
    expect(operatorInlineLink('https://x/"a', '<b>x</b>')).toBe(
      '<a href="https://x/&quot;a" style="color:#1F2937;font-weight:700">&lt;b&gt;x&lt;/b&gt;</a>',
    );
  });

  // ── Plain text ─────────────────────────────────────────────────────────────

  it('the text part mirrors the block order and carries every URL', () => {
    const { text } = render(
      [
        { kind: 'logo' },
        { kind: 'headline', text: 'Headline' },
        { kind: 'paragraph', html: 'Body <b>copy</b>.' },
        { kind: 'button', label: 'Go', url: 'https://x/go' },
        { kind: 'secondary', label: 'Or this', url: 'https://x/alt' },
      ],
      { variant: 'transactional' },
    );
    expect(text).toContain('Headline\n--------');
    expect(text).toContain('Body copy.');
    expect(text).toContain('Go: https://x/go');
    expect(text).toContain('Or this: https://x/alt');
    // The wordmark is chrome; it would only be noise in a plain-text part.
    expect(text).not.toContain('ISLAND');
    expect(text.indexOf('Go: ')).toBeLessThan(text.indexOf('Or this: '));
  });
});
