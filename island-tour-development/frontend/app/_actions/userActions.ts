'use server';

import { authClient } from '@/lib/auth-client';
import { headers } from 'next/headers';
import { cache } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

/**
 * Headers for the dashboard auth-guard's server-to-server backend calls. Forwards
 * the user's session cookie (authenticates as that user) AND the server-only
 * internal API secret (`INTERNAL_API_SECRET`) so this trusted first-party origin
 * bypasses the backend's per-IP throttle. Without the bypass, the guard's fan-out
 * (session + /users/me + operator + settings) plus the dashboard page's own
 * request burst can trip the limiter, fail this check, and bounce a logged-in
 * user to /login. The secret is server-only and never reaches the browser.
 */
function serverAuthHeaders(cookie: string): Record<string, string> {
    const headers: Record<string, string> = { cookie };
    const secret = process.env.INTERNAL_API_SECRET;
    if (secret) headers['x-internal-api-key'] = secret;
    return headers;
}

// ─── Set password for OAuth-only users ───────────────────────────────────────
// Better Auth's setPassword endpoint is server-only - it must be called with
// the session cookie forwarded from a server context, never from the browser.

export async function setPasswordAction(newPassword: string): Promise<void> {
    const cookie = (await headers()).get('cookie') ?? '';
    const res = await fetch(`${BACKEND_URL}/api/v1/users/me/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
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
        const [sessionRes, userRes] = await Promise.all([
            authClient.getSession({ fetchOptions: { headers: serverAuthHeaders(cookie) } }),
            fetch(`${BACKEND_URL}/api/v1/users/me`, { headers: serverAuthHeaders(cookie) }),
        ]);

        if (!sessionRes.data?.user || !userRes.ok) return null;

        const userData = await safeJson(userRes);
        if (!userData) return null;

        const userRole = (sessionRes.data.user as any).role;
        const opId = userData.operator?.id;

        if ((userRole === 'TOUR_OPERATOR' || userRole === 'ADMIN') && opId) {
            const [company, social] = await Promise.all([
                safeJson(await fetch(`${BACKEND_URL}/api/v1/operators/${opId}/company-info`, { headers: serverAuthHeaders(cookie) })),
                safeJson(await fetch(`${BACKEND_URL}/api/v1/operators/${opId}/social-media`, { headers: serverAuthHeaders(cookie) })),
            ]);
            userData.operator = { ...userData.operator, companyInfo: company, socialMedia: social };
        }

        if (userRole === 'ADMIN') {
            const adminSocial = await safeJson(
                await fetch(`${BACKEND_URL}/api/v1/settings/social-media`, { headers: serverAuthHeaders(cookie) })
            );
            userData.operator = { ...userData.operator, socialMedia: adminSocial };
        }

        return userData;
    } catch {
        return null;
    }
});
