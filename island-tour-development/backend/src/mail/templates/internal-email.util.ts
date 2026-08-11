/**
 * Shared building blocks for the INTERNAL email family (INT-1, INT-2, and
 * WP-D's INT1R). The wireframe locks one visual style for operational mail -
 * a dark CTA and a compact facts table - and these helpers are its single
 * source so the copies cannot drift.
 *
 * Values passed to `factRow` must be PRE-ESCAPED by the caller (some rows
 * legitimately carry markup, e.g. a link cell).
 */

/** The wireframe's dark CTA - operational mail must never read as marketing. */
export const INTERNAL_CTA_BACKGROUND = '#1F2937';

/**
 * Internal-table row in the wireframe's exact style. The trailing space in
 * the label cell and the newline between rows are for the shell's PLAIN-TEXT
 * part, which strips tags without inserting spacing - both are invisible in
 * the rendered HTML.
 */
export function factRow(label: string, value: string): string {
  return `<tr><td style="padding:4px 0;color:#6B7280">${label} </td><td style="padding:4px 0;text-align:right;font-weight:600">${value}</td></tr>`;
}

/** Wraps `factRow` rows in the wireframe's facts-table chrome. */
export function internalFactsTable(rows: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13.5px;color:#374151">${rows.join('\n')}</table>`;
}

/** Wireframe format: "Jul 9, 2026, 14:32" in the sales team's timezone. */
export function formatInternalTimestamp(at: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Curacao',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
}
