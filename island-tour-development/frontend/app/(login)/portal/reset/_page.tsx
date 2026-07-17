import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OperatorReset } from '@/components/frontend/login/operator-reset';

export const metadata: Metadata = {
    title: 'Reset password | Island Tours operator portal',
    robots: { index: false, follow: false },
};

export default function OperatorResetPage({
    searchParams,
}: {
    searchParams: Promise<{ state?: string }>;
}) {
    // `searchParams` is request-time (dynamic) data. Under Cache Components
    // (next.config.ts `cacheComponents: true`) any dynamic access must sit inside
    // a <Suspense> boundary so the static portal shell can prerender while the
    // card streams in. The card side lives in the portal layout's MountReveal.
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
    return <OperatorReset expired={state === 'expired'} />;
}

/** Card-shaped skeleton shown for the instant it takes to resolve the query param. */
function ResetCardFallback() {
    return (
        <div className='w-full animate-pulse rounded-[16px] border border-it-border bg-it-white px-7 pb-6.5 pt-7.5 shadow-it-md'>
            <div className='mb-2 h-6 w-2/3 rounded-md bg-it-border/70' />
            <div className='mb-6 h-4 w-11/12 rounded-md bg-it-border/50' />
            <div className='mb-4 h-11 w-full rounded-[10px] bg-it-border/50' />
            <div className='h-11 w-full rounded-[10px] bg-it-border/70' />
        </div>
    );
}
