'use server';

import { authClient } from '@/lib/auth-client';
import { cacheLife, cacheTag } from 'next/cache';
import { headers } from 'next/headers';
import { cache } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

async function safeJson(res: Response) {
    try {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
}

// ─── Dashboard layout auth guard ─────────────────────────────────────────────

export const getUserProfile = cache(async (cookie: string) => {
    'use cache';
    cacheTag('user-profile');
    cacheLife('minutes');

    if (!cookie) return null;

    try {
        const [sessionRes, userRes] = await Promise.all([
            authClient.getSession({ fetchOptions: { headers: { cookie } } }),
            fetch(`${BACKEND_URL}/api/v1/users/me`, { headers: { cookie } }),
        ]);

        if (!sessionRes.data?.user || !userRes.ok) return null;

        const userData = await safeJson(userRes);
        if (!userData) return null;

        const userRole = (sessionRes.data.user as any).role;
        const opId = userData.operator?.id;

        if ((userRole === 'TOUR_OPERATOR' || userRole === 'ADMIN') && opId) {
            const [company, social] = await Promise.all([
                safeJson(await fetch(`${BACKEND_URL}/api/v1/operators/${opId}/company-info`, { headers: { cookie } })),
                safeJson(await fetch(`${BACKEND_URL}/api/v1/operators/${opId}/social-media`, { headers: { cookie } })),
            ]);
            userData.operator = { ...userData.operator, companyInfo: company, socialMedia: social };
        }

        if (userRole === 'ADMIN') {
            const adminSocial = await safeJson(
                await fetch(`${BACKEND_URL}/api/v1/settings/social-media`, { headers: { cookie } })
            );
            userData.operator = { ...userData.operator, socialMedia: adminSocial };
        }

        return userData;
    } catch {
        return null;
    }
});
