import { Suspense } from 'react';

import { ConfirmPasswordChangeClient } from '@/components/profile/confirm-password-change-client';

/**
 * Landing page for the emailed password-change link. The token arrives as a
 * query param and is redeemed by an explicit button press on the client - see
 * the component for why this is not applied on load.
 *
 * The page body touches NO runtime data, so it prerenders as a static shell
 * and `?token=` is read inside the Suspense boundary. Awaiting `searchParams`
 * directly in the page makes the whole route block on runtime data
 * ("Blocking Route", Next 16). The sibling pages under `(app)` await it inline
 * without complaint only because that layout already reads cookies, which
 * turns the segment dynamic before the page runs; this group deliberately has
 * no such layout (see `(public)/layout.tsx`).
 */
export default function ConfirmPasswordChangePage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>;
}) {
    return (
        <Suspense fallback={<ConfirmSkeleton />}>
            <ConfirmPasswordChangeLoader searchParams={searchParams} />
        </Suspense>
    );
}

async function ConfirmPasswordChangeLoader({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>;
}) {
    const { token } = await searchParams;
    return <ConfirmPasswordChangeClient token={token} />;
}

function ConfirmSkeleton() {
    return (
        <div className='mx-auto max-w-md py-16'>
            <div className='rounded-lg border bg-card p-6'>
                <div className='h-5 w-56 animate-pulse rounded bg-muted' />
                <div className='mt-3 h-4 w-full animate-pulse rounded bg-muted' />
                <div className='mt-2 h-4 w-3/4 animate-pulse rounded bg-muted' />
                <div className='mt-6 h-9 w-48 animate-pulse rounded bg-muted' />
            </div>
        </div>
    );
}
