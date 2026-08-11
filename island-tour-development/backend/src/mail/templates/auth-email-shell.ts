/**
 * Shared shell for the account/auth emails (operator invite, password reset,
 * email verification). Mirrors the booking family's shell
 * (booking-notice.template.html) VERBATIM - same background, card, type
 * family, ink/muted colors, orange CTA, and sign-off block - so every email
 * the platform sends reads as one system and cannot drift apart.
 *
 * The brand bar shows the dashboard-managed logo when the caller provides it
 * (MailService reads it from SiteInfo) and falls back to the shell's text-logo
 * variant - the same [IF siteLogoUrl] behavior as the booking shell.
 */

export interface AuthEmailShellProps {
  /** <title>, preheader, and the headline. */
  title: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
  /** "Hi Name," line above the paragraphs; omitted when absent. */
  greeting?: string;
  /** Body copy lines (developer-authored; may contain inline markup). */
  paragraphs: string[];
  /**
   * A one-time code, shown as the centrepiece instead of buried in a sentence.
   * When present the CTA becomes optional - the code IS the payload.
   */
  code?: string;
  /** Label under the code, e.g. "Expires in 10 minutes". */
  codeNote?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /**
   * CTA background. Defaults to the brand orange; the INTERNAL family (INT-1,
   * INT-2) passes the wireframe's dark #1F2937 so operational mail never
   * reads as marketing, and OB-4's WhatsApp rescue passes #16A34A — the ONE
   * green button in the family (onboarding wireframe design constants).
   * Deliberately a literal union, not string: the value lands unescaped in a
   * style attribute, so the type is what keeps a future caller from ever
   * routing user data into it. Extend the union when the design family grows.
   */
  ctaBackground?: '#E8611A' | '#1F2937' | '#16A34A';
  /** Muted line under the link fallback (e.g. "didn't request this?"). */
  footnote?: string;
  /**
   * LIFECYCLE emails only (OB-3/4/6/7/8): the WP-A unsubscribe link for the
   * sign-off block's last line — "Prefer no setup emails? Opt out here."
   * (onboarding wireframe rules footer: the opt-out rides the lifecycle set
   * only). When present it REPLACES the "transactional account email" line,
   * which would be a lie on a nudge. Server-minted token URLs only — never
   * user-supplied strings (the SendMailOptions.headers contract applies to
   * the body link too).
   */
  optOutUrl?: string;
}

/**
 * The type scale. Bigger and lighter than the old 14px/800 setting: these are
 * short, one-decision emails, and at this size they read as a sentence rather
 * than as dense UI chrome. `emphasis` is what template copy should use for
 * inline bolding - 600 against a 400 body, never the browser's 700 <b>.
 */
export const EMAIL_EMPHASIS = 'font-weight:600;color:#1F2937';

/** Escapes HTML-significant characters so user data cannot inject markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function authEmailShell({
  title,
  siteLogoUrl,
  greeting,
  paragraphs,
  code,
  codeNote,
  ctaLabel,
  ctaUrl,
  ctaBackground = '#E8611A',
  footnote,
  optOutUrl,
}: AuthEmailShellProps): { html: string; text: string } {
  // Same brand-bar variants as booking-notice.template.html.
  const brandBar = siteLogoUrl
    ? `<img src="${siteLogoUrl}" height="48" alt="Island Tours" style="display:block;border:0;height:48px;width:auto">`
    : `<span style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-weight:800;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#1F2937">ISLAND <span style="color:#E8611A">TOURS</span></span>`;

  const line = (content: string) =>
    `<div style="font-size:17px;font-weight:400;color:#4B5563;line-height:1.65;margin-bottom:14px">${content}</div>`;

  const bodyBlocks = [
    ...(greeting ? [line(greeting)] : []),
    ...paragraphs.map(line),
  ].join('\n          ');

  // The code, when there is one. No tinted panel and no border: emphasis in
  // this family is TYPE - size, weight and ink - so the code simply becomes the
  // biggest thing on the page. Plain text rather than an image so it survives
  // image blocking and can still be copied.
  const codeBlock = code
    ? `
          <div style="font-size:36px;font-weight:600;letter-spacing:.14em;line-height:1.2;color:#1F2937;margin:2px 0 10px">${escapeHtml(code)}</div>
          ${codeNote ? `<div style="font-size:15px;font-weight:400;color:#9aa3b2;margin-bottom:16px">${escapeHtml(codeNote)}</div>` : ''}`
    : '';

  // The CTA is optional: a code email already carries its payload, so the
  // button (and its "if the button doesn't work" fallback) would be noise.
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
          <a href="${ctaUrl}" style="display:inline-block;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;font-weight:500;color:#fff;background:${ctaBackground};text-decoration:none;border-radius:10px;padding:13px 24px;margin-top:4px">${ctaLabel}</a>

          <div style="font-size:14px;font-weight:400;color:#9aa3b2;margin-top:18px;line-height:1.65">If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${ctaUrl}" style="color:#4B5563;word-break:break-all">${ctaUrl}</a>
          </div>`
      : '';

  // Lifecycle emails carry the opt-out where transactional ones state their
  // nature — same slot, so the sign-off block keeps one shape family-wide.
  const footerLastLine = optOutUrl
    ? `Prefer no setup emails? <a href="${optOutUrl}" style="color:#b6bcc7;text-decoration:underline">Opt out here</a>.`
    : 'This is a transactional account email.';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;800&display=swap" rel="stylesheet">
  <style>
    /* Lock the palette to the light design. Clients that honor color-scheme
       (Apple Mail, iOS) stop inverting the card and logo in dark mode; Gmail
       ignores it - the logo itself ships with a baked-in white chip for that. */
    :root { color-scheme: light; supported-color-schemes: light; }

    @media only screen and (max-width: 480px) {
      .it-shell-pad { padding: 12px 6px !important; }
      .it-cell { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#EDEFF2;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1F2937;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${title}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#EDEFF2">
    <tr><td align="center" class="it-shell-pad" style="padding:26px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E8EAED;border-collapse:separate">

        <!-- Brand bar -->
        <tr><td class="it-cell" style="padding:18px 28px;border-bottom:1px solid #E8EAED">
          ${brandBar}
        </td></tr>

        <!-- Headline -->
        <tr><td class="it-cell" style="padding:30px 28px 6px;font-family:'Plus Jakarta Sans',Arial,sans-serif">
          <div style="font-size:28px;font-weight:500;letter-spacing:-.02em;line-height:1.25;color:#1F2937">${title}</div>
        </td></tr>

        <!-- Body -->
        <tr><td class="it-cell" style="padding:18px 28px 4px;font-family:'Plus Jakarta Sans',Arial,sans-serif">
          ${bodyBlocks}${codeBlock}${ctaBlock}
          ${
            footnote
              ? `\n          <div style="font-size:14px;font-weight:400;color:#9aa3b2;margin-top:14px;line-height:1.65">${footnote}</div>`
              : ''
          }
        </td></tr>

        <!-- Sign-off -->
        <tr><td class="it-cell" style="padding:26px 28px 26px;font-family:'Plus Jakarta Sans',Arial,sans-serif">
          <div style="border-top:1px solid #E8EAED;padding-top:20px">
            <div style="font-size:15px;font-weight:600;color:#1F2937">Island Tours. Built by Islanders.</div>
            <div style="font-size:14px;font-weight:400;color:#9aa3b2;margin-top:5px">www.island.tours</div>
            <div style="font-size:13px;font-weight:400;color:#b6bcc7;margin-top:12px;line-height:1.65">ITG B.V. (Island Tours Group) · KvK Curaçao 169950<br>Caracasbaaiweg 366, Willemstad, Curaçao<br>${footerLastLine}</div>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  // Strip inline markup AND decode escaped entities - the callers HTML-escape
  // user data (names) for the HTML part, which must read plain in the text part.
  const toText = (value: string) =>
    value
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  const text = [
    title,
    '-'.repeat(title.length),
    '',
    ...(greeting ? [toText(greeting), ''] : []),
    ...paragraphs.map(toText),
    ...(code ? ['', code, ...(codeNote ? [codeNote] : [])] : []),
    ...(ctaLabel && ctaUrl ? ['', `${ctaLabel}: ${ctaUrl}`] : []),
    ...(footnote ? ['', toText(footnote)] : []),
    '',
    'Island Tours. Built by Islanders.',
    ...(optOutUrl
      ? [`Prefer no setup emails? Opt out here: ${optOutUrl}`]
      : []),
  ].join('\n');

  return { html, text };
}
