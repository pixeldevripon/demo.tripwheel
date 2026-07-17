'use client';

/**
 * Simple page heading. Editing moved into the individual cards (Phase 20),
 * so the header no longer owns a page-wide edit mode.
 */
export function ProfileHeader() {
    return (
        <div>
            <h1 className='text-2xl font-semibold'>My Profile</h1>
            <p className='text-sm text-content-muted mt-1'>
                Manage your profile information.
            </p>
        </div>
    );
}
