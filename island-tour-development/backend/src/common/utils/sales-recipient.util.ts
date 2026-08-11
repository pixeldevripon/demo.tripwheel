/**
 * The ENV layer of the sales-pipeline recipient resolution: SALES_EMAIL when
 * configured, else the ADMIN_EMAIL reviewer mailbox, else null.
 *
 * Since WP-H this is no longer read directly by the alert senders (INT-1 new
 * operator, INT-2 new tour, INT1R pending reminder) — they resolve the
 * recipient through `EmailSettingsService.resolve().salesEmail`, which puts
 * the dashboard-stored address FIRST and calls this function as its env
 * fallback. A missing mailbox everywhere still means the caller logs and
 * skips (the tour-submitted precedent in tours.service.ts: a missing mailbox
 * must never fail or roll back the mutation that triggered the alert).
 *
 * Read raw from process.env on purpose: both vars are optional-with-fallback
 * (plan §2.7) and this also runs before env validation in the DI-free
 * MailService singleton path.
 */
export function salesRecipient(): string | null {
  return (
    process.env.SALES_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim() || null
  );
}
