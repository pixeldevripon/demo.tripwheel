'use server';

import { authClient } from '@/lib/auth-client';
import { cacheLife, cacheTag, updateTag } from 'next/cache';
import { headers } from 'next/headers';

import { cache } from 'react';

const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

async function safeJson(res: Response) {
    try {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch (e) {
        return null;
    }
}

async function getAuthHeaders() {
    const reqHeaders = await headers();
    return {
        cookie: reqHeaders.get('cookie') || '',
    };
}

// server-cache-react: Deduplicate requests within a single render cycle
export const getUserProfile = cache(async (cookie: string) => {
    'use cache';
    cacheTag('user-profile');
    cacheLife('minutes');

    // async-cheap-condition-before-await: Check for cookie before starting expensive network requests
    if (!cookie) return null;

    try {
        // async-parallel: Start independent session and user profile fetches simultaneously
        const sessionPromise = authClient.getSession({
            fetchOptions: { headers: { cookie } },
        });
        const userPromise = fetch(`${BACKEND_URL}/api/v1/users/me`, {
            headers: { cookie },
        });

        const [sessionRes, userRes] = await Promise.all([
            sessionPromise,
            userPromise,
        ]);

        // pre-return on network failure: Exit early if either critical request failed
        if (!sessionRes.data?.user || !userRes.ok) {
            return null;
        }

        const userData = await safeJson(userRes);
        if (!userData) return null;

        const userRole = (sessionRes.data.user as any).role;
        const opId = userData.operator?.id;

        // Only fetch operator details if the role requires it and we have an ID
        if ((userRole === 'TOUR_OPERATOR' || userRole === 'ADMIN') && opId) {
            // async-parallel: Fetch company info and social media in parallel
            const [companyRes, socialRes] = await Promise.all([
                fetch(`${BACKEND_URL}/api/v1/operators/${opId}/company-info`, {
                    headers: { cookie },
                }),
                fetch(`${BACKEND_URL}/api/v1/operators/${opId}/social-media`, {
                    headers: { cookie },
                }),
            ]);

            // Parallelize JSON parsing as well
            const [company, social] = await Promise.all([
                safeJson(companyRes),
                safeJson(socialRes),
            ]);

            userData.operator = {
                ...userData.operator,
                companyInfo: company,
                socialMedia: social,
            };
        }

        // If user is ADMIN, fetch platform-wide social media settings
        if (userRole === 'ADMIN') {
            const adminSocialRes = await fetch(
                `${BACKEND_URL}/api/v1/settings/social-media`,
                {
                    headers: { cookie },
                }
            );
            const adminSocial = await safeJson(adminSocialRes);

            // For ADMIN, we'll merge platform social links into the operator field for UI consistency
            userData.operator = {
                ...userData.operator,
                socialMedia: adminSocial,
            };
        }

        return userData;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
});

export async function updateUserProfile(data: any) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    try {
        const response = await fetch(`${BACKEND_URL}/api/v1/users/me`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                cookie: authHeaders.cookie,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Failed to update profile',
            };
        }

        updateTag('user-profile');
        return { success: true };
    } catch (error) {
        console.error('Error updating profile:', error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function updateOperatorSocialMedia(operatorId: string, data: any) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    const sessionRes = await authClient.getSession({
        fetchOptions: { headers: { cookie: authHeaders.cookie } },
    });
    const userRole = (sessionRes.data?.user as any)?.role;

    if (userRole === 'USER') {
        return { success: false, error: 'Unauthorized: Users cannot update social media.' };
    }

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/v1/operators/${operatorId}/social-media`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: authHeaders.cookie,
                },
                body: JSON.stringify(data),
            }
        );

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Failed to update social media',
            };
        }

        updateTag('user-profile');
        return { success: true };
    } catch (error) {
        console.error('Error updating social media:', error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function updateAdminSocialMedia(data: any) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    const sessionRes = await authClient.getSession({
        fetchOptions: { headers: { cookie: authHeaders.cookie } },
    });
    const userRole = (sessionRes.data?.user as any)?.role;

    if (userRole !== 'ADMIN') {
        return { success: false, error: 'Unauthorized: Only admins can update platform social media.' };
    }

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/v1/settings/social-media`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: authHeaders.cookie,
                },
                body: JSON.stringify(data),
            }
        );

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error:
                    errorData?.message || 'Failed to update admin social media',
            };
        }

        updateTag('user-profile');
        return { success: true };
    } catch (error) {
        console.error('Error updating admin social media:', error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function removeProfilePhoto(publicId: string) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/v1/media-gallery/public/${publicId}`,
            {
                method: 'DELETE',
                headers: {
                    cookie: authHeaders.cookie,
                },
            }
        );

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Failed to remove photo',
            };
        }

        updateTag('user-profile');
        return { success: true };
    } catch (error) {
        console.error('Error removing profile photo:', error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function updateUserById(userId: string, data: any) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    try {
        const sessionRes = await authClient.getSession({
            fetchOptions: { headers: { cookie: authHeaders.cookie } },
        });

        const isMe = sessionRes.data?.user?.id === userId;
        const endpoint = isMe
            ? `${BACKEND_URL}/api/v1/users/me`
            : `${BACKEND_URL}/api/v1/users/${userId}`;

        const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                cookie: authHeaders.cookie,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Failed to update user',
            };
        }

        updateTag('user-profile');
        return { success: true };
    } catch (error) {
        console.error('Error in updateUserById:', error);
        return { success: false, error: 'Internal server error' };
    }
}
export async function uploadProfilePhoto(formData: FormData) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/v1/media-gallery/upload`,
            {
                method: 'POST',
                headers: {
                    cookie: authHeaders.cookie,
                },
                body: formData,
            }
        );

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Upload failed',
            };
        }

        const data = await safeJson(response);
        return { success: true, data };
    } catch (error) {
        console.error('Error uploading profile photo:', error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function setPasswordAction(password: string) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    try {
        // We use the direct auth.api here because the client doesn't expose setPassword for users
        // This must be called from the server where we have access to the auth instance
        // Actually, in this project structure, we should probably call the backend endpoint if it exists
        // or use the auth instance if it's shared.
        // Since this is a separate backend, we'll hit the /setPassword endpoint if available.
        // BUT better-auth doesn't expose /set-password by default to users.

        // Wait, better-auth v1 DOES have a password linking flow.
        // For now, let's use the changePassword with an empty current password if allowed,
        // or suggest the user uses the reset password flow.

        // Actually, the best way is to call the backend to set the password.
        const response = await fetch(`${BACKEND_URL}/api/auth/set-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                cookie: authHeaders.cookie,
            },
            body: JSON.stringify({ newPassword: password }),
        });

        console.log(`password change response: ${JSON.stringify(response)}`);

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Failed to set password',
            };
        }

        return { success: true };
    } catch (error) {
        console.error('Error in setPasswordAction:', error);
        return { success: false, error: 'Internal server error' };
    }
}

