'use server';

import { headers } from 'next/headers';

const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

async function safeJson(res: Response) {
    try {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
}

async function getAuthHeaders() {
    const reqHeaders = await headers();
    return {
        cookie: reqHeaders.get('cookie') || '',
    };
}

// ─── Get Media ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/media-gallery?limit=200&page=1
 * Returns paginated list of authenticated user's media.
 */
export async function getAllMedia(queryString = 'limit=200&page=1') {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/v1/media-gallery?${queryString}`,
            {
                headers: {
                    cookie: authHeaders.cookie,
                },
                cache: 'no-store',
            }
        );

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Failed to fetch media',
            };
        }

        const data = await safeJson(response);
        // Normalize: backend returns { total, page, limit, data }
        // Wrap as { result: { media: [...] } } for compatibility with source pattern
        return {
            success: true,
            result: {
                media: data?.data || [],
                total: data?.total || 0,
                page: data?.page || 1,
                limit: data?.limit || 200,
            },
        };
    } catch (error) {
        console.error('Error fetching media:', error);
        return { success: false, error: 'Internal server error' };
    }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/media-gallery/upload
 * Uploads one or more files through the NestJS server to Cloudinary.
 */
export async function uploadMultipleImage(
    files: File[],
    options: { folder?: string } = {}
) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { error: 'Unauthorized', uploadedMediaData: [] };

    try {
        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }

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
                error: errorData?.message || 'Upload failed',
                uploadedMediaData: [],
            };
        }

        const data = await safeJson(response);
        // Backend returns MediaGallery[] — normalize to expected shape
        const uploadedMediaData = Array.isArray(data) ? data : [];
        return { error: null, uploadedMediaData };
    } catch (error) {
        console.error('Error uploading media:', error);
        return { error: 'Upload failed', uploadedMediaData: [] };
    }
}

// ─── Signed Upload (direct client → Cloudinary) ───────────────────────────────

/**
 * GET /api/v1/media-gallery/sign
 * Get signed params for direct client-side upload to Cloudinary.
 */
export async function getSignedUploadParams() {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    try {
        const response = await fetch(`${BACKEND_URL}/api/v1/media-gallery/sign`, {
            headers: { cookie: authHeaders.cookie },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Failed to get signed params',
            };
        }

        const data = await safeJson(response);
        return { success: true, result: data };
    } catch (error) {
        console.error('Error getting signed params:', error);
        return { success: false, error: 'Internal server error' };
    }
}

/**
 * POST /api/v1/media-gallery/confirm
 * Confirms a completed direct Cloudinary upload and saves to DB.
 */
export async function confirmUpload(dto: {
    publicId: string;
    url: string;
    resourceType: string;
}) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/v1/media-gallery/confirm`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: authHeaders.cookie,
                },
                body: JSON.stringify(dto),
            }
        );

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Failed to confirm upload',
            };
        }

        const data = await safeJson(response);
        return { success: true, result: data };
    } catch (error) {
        console.error('Error confirming upload:', error);
        return { success: false, error: 'Internal server error' };
    }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * DELETE /api/v1/media-gallery/:id
 */
export async function deleteMedia(id: string) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/v1/media-gallery/${id}`,
            {
                method: 'DELETE',
                headers: { cookie: authHeaders.cookie },
            }
        );

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Failed to delete media',
            };
        }

        return { success: true };
    } catch (error) {
        console.error('Error deleting media:', error);
        return { success: false, error: 'Internal server error' };
    }
}

/**
 * DELETE /api/v1/media-gallery/bulk
 * Sends one request with an array of IDs — the backend deletes from
 * Cloudinary in parallel and batch-removes from the DB.
 */
export async function bulkDeleteMedia(ids: string[]) {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.cookie) return { success: false, error: 'Unauthorized' };

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/v1/media-gallery/bulk`,
            {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    cookie: authHeaders.cookie,
                },
                body: JSON.stringify({ ids }),
            }
        );

        if (!response.ok) {
            const errorData = await safeJson(response);
            return {
                success: false,
                error: errorData?.message || 'Bulk delete failed',
            };
        }

        const data = await safeJson(response);
        // data = { deleted: number, failed: number }
        return { success: true, result: { count: data?.deleted ?? ids.length } };
    } catch (error) {
        console.error('Error bulk deleting media:', error);
        return { success: false, error: 'Internal server error' };
    }
}

