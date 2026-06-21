export interface BookingConfirmationTemplateProps {
  customerName?: string | null;
  displayRef: string;
  tourTitle: string;
  localDate: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM
  partySize: number;
  currency: string;
  totalRetail: string;
  depositPaid?: string | null; // amount charged now (null when nothing was charged)
  balanceDue?: string | null; // collected by the operator on arrival
  manageUrl?: string | null;
}

export function bookingConfirmationTemplate({
  customerName,
  displayRef,
  tourTitle,
  localDate,
  startTime,
  partySize,
  currency,
  totalRetail,
  depositPaid,
  balanceDue,
  manageUrl,
}: BookingConfirmationTemplateProps) {
  const greeting = customerName ? `Hi ${customerName},` : 'Hi there,';
  const when = startTime ? `${localDate} at ${startTime}` : localDate;

  const row = (label: string, value: string) => `
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;">${label}</td>
            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${value}</td>
          </tr>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your booking is confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#0f172a;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                🏝 Island Tours
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Your booking is confirmed 🎉</h2>
              <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.6;">
                ${greeting}<br/>
                Thanks for booking with Island Tours. Your confirmation reference is
                <strong>${displayRef}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;">
                ${row('Tour', tourTitle)}
                ${row('Date', when)}
                ${row('Guests', String(partySize))}
                ${row('Total', `${currency} ${totalRetail}`)}
                ${depositPaid ? row('Paid now', `${currency} ${depositPaid}`) : ''}
                ${balanceDue && balanceDue !== '0' ? row('Due on arrival', `${currency} ${balanceDue}`) : ''}
              </table>
              ${
                manageUrl
                  ? `<div style="text-align:center;margin-top:32px;">
                       <a href="${manageUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;">View booking</a>
                     </div>`
                  : ''
              }
              <p style="margin:32px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
                Keep this email for your records. If you have any questions, just reply and our team will help.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${greeting}`,
    `Your Island Tours booking is confirmed.`,
    `Reference: ${displayRef}`,
    `Tour: ${tourTitle}`,
    `Date: ${when}`,
    `Guests: ${partySize}`,
    `Total: ${currency} ${totalRetail}`,
    depositPaid ? `Paid now: ${currency} ${depositPaid}` : '',
    balanceDue && balanceDue !== '0' ? `Due on arrival: ${currency} ${balanceDue}` : '',
    manageUrl ? `View booking: ${manageUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
}
