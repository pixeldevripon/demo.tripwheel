/**
 * Where the internal sales-pipeline alerts (INT-1 new operator, INT-2 new
 * tour, INT1R pending reminder) go: SALES_EMAIL when configured, else the
 * ADMIN_EMAIL reviewer mailbox, else null - the caller logs and skips (the
 * tour-submitted precedent in tours.service.ts: a missing mailbox must never
 * fail or roll back the mutation that triggered the alert).
 *
 * Read raw from process.env on purpose: env.validate.ts is owned by WP-A in
 * the email programme and both vars are optional-with-fallback (plan §2.7).
 */
export function salesRecipient(): string | null {
  return (
    process.env.SALES_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim() || null
  );
}
