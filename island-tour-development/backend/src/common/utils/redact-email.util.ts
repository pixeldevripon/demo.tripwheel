/**
 * `jane@host.com` -> `j***@host.com`. The ONE redaction used everywhere an
 * email address may reach a log line or a public payload (MailService logs,
 * the unsubscribe resolve response, email-log scope ids). Single owner so
 * the shapes cannot drift.
 */
export function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}
