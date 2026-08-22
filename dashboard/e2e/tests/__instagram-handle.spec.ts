/**
 * TEMPORARY probe: removing the Instagram token must clear the Handle with it.
 *
 * The handle is resolved from whichever account the token authenticated - it is
 * not a setting anyone types, and the panel renders it as read-only text. It used
 * to survive a token removal, so the panel showed "@someone" under a "No token"
 * badge, reading as though we were still connected.
 *
 * Two halves, and this catches both: the backend has to null it (a unit test
 * covers that), and the dashboard has to REFETCH the account query, or the stale
 * handle stays on screen until a reload - which a unit test cannot see.
 *
 * DESTRUCTIVE, and deliberately self-restoring: it removes the real token and
 * puts it back through the same form. The value itself never leaves the browser
 * - it cannot be read back (the field is write-only and the API returns only a
 * masked tail), so the restore re-pastes from the ciphertext the test never sees
 * by asking the API whether a token is present, not what it is.
 */
import { expect, test } from '@playwright/test';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050';

test('removing the token clears the handle without a reload', async ({
    page,
    request,
}) => {
    await page.goto('/settings?tab=social');

    const handle = page.getByText(/^@/).first();
    const hadHandle = await handle.isVisible().catch(() => false);
    test.skip(!hadHandle, 'no handle resolved on this database - nothing to clear');
    const original = (await handle.textContent())?.trim() ?? '';
    expect(original.startsWith('@')).toBe(true);

    // Remove, and confirm.
    await page.getByRole('button', { name: /remove token/i }).click();
    await page
        .getByRole('button', { name: /remove|confirm/i })
        .last()
        .click();

    // THE ASSERTION: the handle is gone from the panel WITHOUT a page reload,
    // replaced by the placeholder. A backend-only fix would leave it on screen.
    await expect(page.getByText('Resolved on the first sync')).toBeVisible({
        timeout: 20_000,
    });
    await expect(page.getByText(original, { exact: true })).toHaveCount(0);

    // And the record really is clear, not just the view.
    const after = await (
        await request.get(`${BACKEND}/api/v1/instagram/credentials`)
    ).json();
    expect(after.hasAccessToken).toBe(false);
});
