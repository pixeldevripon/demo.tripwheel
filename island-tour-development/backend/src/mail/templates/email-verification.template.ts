export interface EmailVerificationTemplateProps {
  verifyUrl: string;
  name?: string;
}

export function emailVerificationTemplate({
  verifyUrl,
  name,
}: EmailVerificationTemplateProps) {
  const greeting = name ? `Hi ${name},` : 'Welcome to Island Tours!';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email address</title>
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
                Verify your email address
              </h2>
              <p style="margin:0 0 8px;color:#475569;font-size:15px;line-height:1.6;">
                ${greeting}
              </p>
              <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
                Thanks for signing up. Please verify your email address to activate your account and start exploring tours.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background:#0f172a;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:6px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:4px 0 0;font-size:13px;word-break:break-all;">
                <a href="${verifyUrl}" style="color:#0f172a;">${verifyUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
              <p style="margin:0;color:#94a3b8;font-size:13px;">
                If you didn't create an Island Tours account, you can safely ignore this email.
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
Verify your Island Tours email address
----------------------------------------

${greeting}

Thanks for signing up! Please verify your email to activate your account:
${verifyUrl}

If you didn't create an Island Tours account, you can safely ignore this email.

© ${new Date().getFullYear()} Island Tours
  `.trim();

  return { html, text };
}
