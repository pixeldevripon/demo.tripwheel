import { redirect } from 'next/navigation';

/**
 * The email switchboard moved into Settings → Email (founder request
 * 2026-08-12) so every configuration surface sits under one roof. This route
 * survives as a redirect for bookmarks and for the runbook's older
 * "Email → Settings" wording.
 *
 * `redirect()`, not `permanentRedirect()`: a 308 is cached by the browser
 * forever, and this path is one founder decision away from meaning something
 * again.
 */
export default function EmailSettingsPage() {
    redirect('/settings?tab=email');
}
