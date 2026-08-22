import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminReset } from '@/components/login/admin-reset';

export const metadata: Metadata = {
    title: 'Set your password | Island Tours admin',
    robots: { index: false, follow: false },
};

export default function AdminResetPage({
    searchParams,
}: {
    searchParams: Promise<{ state?: string }>;
}) {
    // `searchParams` is request-time (dynamic) data. Under Cache Components any
    // dynamic access must sit inside a <Suspense> boundary so the static admin
    // shell can prerender while the card streams in.
    return (
        <Suspense fallback={<ResetCardFallback />}>
            <ResetCard searchParams={searchParams} />
        </Suspense>
    );
}

async function ResetCard({
    searchParams,
}: {
    searchParams: Promise<{ state?: string }>;
}) {
    const { state } = await searchParams;
    return <AdminReset expired={state === 'expired'} />;
}

/** Card-shaped skeleton shown for the instant it takes to resolve the query param. */
function ResetCardFallback() {
    return (
        <div className='w-full animate-pulse rounded-[16px] bg-it-white px-8 pb-6 pt-8 shadow-2xl shadow-black/40'>
            <div className='mb-2 h-6 w-2/3 rounded-md bg-it-border/70' />
            <div className='mb-6 h-4 w-11/12 rounded-md bg-it-border/50' />
            <div className='mb-4 h-11 w-full rounded-[10px] bg-it-border/50' />
            <div className='h-11 w-full rounded-[10px] bg-it-border/70' />
        </div>
    );
}
