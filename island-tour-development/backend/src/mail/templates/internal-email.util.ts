/**
 * Shared building blocks for the INTERNAL email family (INT-1, INT-2, and
 * WP-D's INT1R).
 *
 * The facts-table markup and the dark CTA used to live here as `factRow`,
 * `internalFactsTable` and `INTERNAL_CTA_BACKGROUND`. They moved into
 * `operator-email-shell.ts` — as the `facts` block and the `dark` button tone —
 * when the internal family was rebuilt on that shell, so the wireframe's
 * chrome now has exactly one owner. What is left here is the one thing that is
 * genuinely about internal mail rather than about the shell: how the sales
 * team reads a timestamp.
 */

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
