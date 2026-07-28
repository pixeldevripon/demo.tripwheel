'use server';

import { authClient } from '@/lib/auth-client';
import { serverAuthHeaders } from '@/lib/server/auth-headers';
import { headers } from 'next/headers';
import { cache } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

// ─── Set password for OAuth-only users ───────────────────────────────────────
// Better Auth's setPassword endpoint is server-only - it must be called with
// the session cookie forwarded from a server context, never from the browser.

export async function setPasswordAction(newPassword: string): Promise<void> {
    const cookie = (await headers()).get('cookie') ?? '';
    const res = await fetch(`${BACKEND_URL}/api/v1/users/me/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...serverAuthHeaders(cookie) },
        body: JSON.stringify({ newPassword }),
    });

    if (!res.ok) {
        let message = `Failed to set password (${res.status})`;
        try {
            const body = await res.json();
            if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
        } catch { /* ignore */ }
        throw new Error(message);
    }
}

/**
 * Step 1 of the password change: verify the current password and send the
 * confirmation email. Nothing on the account changes here.
 *
 * A server action rather than a browser fetch for the same reason as
 * setPasswordAction: the backend hands the cookie to Better Auth's
 * server-scope verifyPassword, and this keeps every password operation on one
 * path. The thrown error carries the backend status so the form can tell
 * "wrong password" (401) apart from everything else.
 */
export async function requestPasswordChangeAction(
    currentPassword: string,
    newPassword: string,
): Promise<void> {
    const cookie = (await headers()).get('cookie') ?? '';
    const res = await fetch(`${BACKEND_URL}/api/v1/users/me/password-change/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...serverAuthHeaders(cookie) },
        body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
        const body = await safeJson(res);
        const message = Array.isArray(body?.message)
            ? body.message.join(', ')
            : (body?.message ?? `Failed to start the password change (${res.status})`);
        throw Object.assign(new Error(message), { status: res.status });
    }
}

/**
 * Step 2: redeem the emailed token. Deliberately takes no session - the link
 * is usually opened on a phone that is not signed in; the single-use token is
 * the credential.
 */
export async function confirmPasswordChangeAction(token: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/v1/users/me/password-change/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    });

    if (!res.ok) {
        const body = await safeJson(res);
        const message = Array.isArray(body?.message)
            ? body.message.join(', ')
            : (body?.message ?? `Failed to confirm the password change (${res.status})`);
        throw Object.assign(new Error(message), { status: res.status });
    }
}

async function safeJson(res: Response) {
    try {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
}

// ─── Dashboard layout auth guard ─────────────────────────────────────────────

// Auth state is per-request and must never be cached across requests: a single
// transient failure (a throttle 429 during a dashboard page-mount burst, or any
// network blip) returns null, and caching that null would bounce a logged-in
// user to /login until the entry expired. In `next dev` `use cache` is inert so
// this never bit; in `next start` (production) it does. `cache()` (React) still
// dedupes the call within one server render pass, which is safe.
export const getUserProfile = cache(async (cookie: string) => {
    if (!cookie) return null;

    try {
        const [sessionRes, userRes, permissionsRes] = await Promise.all([
            authClient.getSession({ fetchOptions: { headers: serverAuthHeaders(cookie) } }),
            fetch(`${BACKEND_URL}/api/v1/users/me`, { headers: serverAuthHeaders(cookie) }),
            fetch(`${BACKEND_URL}/api/v1/users/me/permissions`, { headers: serverAuthHeaders(cookie) }),
        ]);

        if (!sessionRes.data?.user || !userRes.ok) return null;

        const userData = await safeJson(userRes);
        if (!userData) return null;

        // EFFECTIVE permission set (staff/team fine-grained grants included).
        // On a transient failure leave it undefined - RoleProvider then falls
        // back to the static role map, and the backend guards still enforce.
        const permissionsData = permissionsRes.ok ? await safeJson(permissionsRes) : null;
        if (Array.isArray(permissionsData?.permissions)) {
            userData.permissions = permissionsData.permissions;
        }

        const userRole = (sessionRes.data.user as any).role;
        const opId = userData.operator?.id;

        const wantsOperatorExtras =
            (userRole === 'TOUR_OPERATOR' || userRole === 'ADMIN') && opId;
        const isAdmin = userRole === 'ADMIN';

        if (wantsOperatorExtras || isAdmin) {
            // Every request is STARTED before any of them is awaited. This was
            // `Promise.all([safeJson(await fetch(A)), safeJson(await fetch(B))])`,
            // which only looks parallel: `await fetch(A)` has to settle before
            // the array's second element is even evaluated, so A and B ran
            // strictly one after the other - and the admin call after both.
            const [companyRes, socialRes, adminSocialRes] = await Promise.all([
                wantsOperatorExtras
                    ? fetch(`${BACKEND_URL}/api/v1/operators/${opId}/company-info`, { headers: serverAuthHeaders(cookie) })
                    : null,
                wantsOperatorExtras
                    ? fetch(`${BACKEND_URL}/api/v1/operators/${opId}/social-media`, { headers: serverAuthHeaders(cookie) })
                    : null,
                isAdmin
                    ? fetch(`${BACKEND_URL}/api/v1/settings/social-media`, { headers: serverAuthHeaders(cookie) })
                    : null,
            ]);

            const [company, social, adminSocial] = await Promise.all([
                companyRes ? safeJson(companyRes) : null,
                socialRes ? safeJson(socialRes) : null,
                adminSocialRes ? safeJson(adminSocialRes) : null,
            ]);

            if (wantsOperatorExtras) {
                userData.operator = { ...userData.operator, companyInfo: company, socialMedia: social };
            }

            // Unchanged precedence: for an admin the platform-wide social
            // settings deliberately overwrite the operator record's own links.
            if (isAdmin) {
                userData.operator = { ...userData.operator, socialMedia: adminSocial };
            }
        }

        return userData;
    } catch {
        return null;
    }
});
