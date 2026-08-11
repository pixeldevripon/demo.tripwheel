import { escapeHtml } from './auth-email-shell';

/**
 * OB-6 "How's it going?" - the day-14 founder check-in that formally ENDS the
 * onboarding sequence. Copy is LOCKED by the onboarding wireframe (stage m6):
 * near-plain text, no buttons, no images, no logo bar - "plain personal
 * check-ins earn replies that designed emails do not" - so this deliberately
 * does NOT ride the auth shell. Reply-To is the founder's monitored inbox
 * (OB6_REPLY_TO, set by the caller on SendMailOptions, never here).
 *
 * Still a lifecycle email: the footer carries sender identity and the WP-A
 * opt-out link like the rest of the OB nudge set.
 */

export interface OperatorCheckInTemplateProps {
  /** Signatory's first name - "Hi {firstName},". */
  firstName?: string;
  /** WP-A unsubscribe token link - lifecycle footer (D-10). */
  optOutUrl: string;
}

export const OPERATOR_CHECK_IN_SUBJECT = "How's it going?";

const CHECK_IN_PARAGRAPHS = [
  "Denley here, founder of Island Tours. One quick question: what's the one thing we could do better for you as an operator?",
  "Hit reply, it lands in my inbox. WhatsApp works too, that's often faster.",
  'Denley',
];

export function operatorCheckInTemplate({
  firstName,
  optOutUrl,
}: OperatorCheckInTemplateProps): { html: string; text: string } {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';
  const p = (content: string) =>
    `<p style="font-size:15px;font-weight:400;color:#374151;line-height:1.65;margin:0 0 14px">${content}</p>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${OPERATOR_CHECK_IN_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#EDEFF2;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1F2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#EDEFF2">
    <tr><td align="center" style="padding:26px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:14px;border:1px solid #EAE7E1;border-collapse:separate">
        <tr><td style="padding:26px 30px 10px">
          ${p(greeting)}
          ${CHECK_IN_PARAGRAPHS.map(p).join('\n          ')}
        </td></tr>
        <tr><td style="padding:0 30px 24px">
          <div style="border-top:1px solid #EAE7E1;padding-top:14px;font-size:11.5px;color:#6B7280;line-height:1.6">
            We'll never ask for your password, codes, or payment by email.<br>
            Island Tours is a service of ITG B.V. (Island Tours Group) &middot; KvK Cura&ccedil;ao 169950<br>
            Willemstad, Cura&ccedil;ao &middot; www.island.tours<br>
            Prefer no setup emails? <a href="${optOutUrl}" style="color:#6B7280;text-decoration:underline">Opt out here</a>.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  const text = [
    firstName ? `Hi ${firstName},` : 'Hi,',
    '',
    CHECK_IN_PARAGRAPHS[0],
    '',
    CHECK_IN_PARAGRAPHS[1],
    '',
    'Denley',
    '',
    `Prefer no setup emails? Opt out here: ${optOutUrl}`,
  ].join('\n');

  return { html, text };
}
