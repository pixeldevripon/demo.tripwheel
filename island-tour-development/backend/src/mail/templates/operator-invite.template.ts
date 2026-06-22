export interface OperatorInviteTemplateProps {
  inviteUrl: string;
  name?: string;
}

/** Escapes HTML-significant characters so a name cannot inject markup into the email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function operatorInviteTemplate({
  inviteUrl,
  name,
}: OperatorInviteTemplateProps) {
  const htmlGreeting = name ? `Hi ${escapeHtml(name)},` : 'Hello,';
  const textGreeting = name ? `Hi ${name},` : 'Hello,';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Island Tours operator account</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                🏝 Island Tours
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;font-weight:600;">
                You've been invited as a Tour Operator
              </h2>
              <p style="margin:0 0 8px;color:#475569;font-size:15px;line-height:1.6;">
                ${htmlGreeting}
              </p>
              <p style="margin:0 0 8px;color:#475569;font-size:15px;line-height:1.6;">
                An Island Tours administrator has created a tour operator account for you.
                To get started, set your password using the button below, then log in to
                complete your onboarding.
              </p>
              <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
                This link will expire in <strong>1 hour</strong>.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background:#0f172a;">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:6px;">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:4px 0 0;font-size:13px;word-break:break-all;">
                <a href="${inviteUrl}" style="color:#0f172a;">${inviteUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                If this link has expired, go to the login page and choose
                <strong>"Forgot password?"</strong> to request a fresh one.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                &copy; ${new Date().getFullYear()} Island Tours. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
You've been invited as a Tour Operator on Island Tours
------------------------------------------------------

${textGreeting}

An Island Tours administrator has created a tour operator account for you.

Set your password using the link below (expires in 1 hour), then log in to
complete your onboarding:
${inviteUrl}

If the link has expired, go to the login page and choose "Forgot password?"
to request a fresh one.

© ${new Date().getFullYear()} Island Tours
  `.trim();

  return { html, text };
}
