/**
 * Placeholder for the streamed cancel-request card (`/cancel/[publicRef]`).
 * Lives here (not inline in the page) so the route's `loading.tsx` and the
 * page's Suspense fallback render the IDENTICAL silhouette - title line,
 * ref line, summary block, two action buttons - at the card's real width.
 */
import { Bar } from './skeleton-bar';

export function CancelCardSkeleton() {
    return (
        <div className='w-full max-w-107.5 rounded-[16px] bg-it-white p-6'>
            <Bar className='h-6 w-3/4 rounded-[6px]' />
            <Bar className='mt-3 h-4 w-1/2 rounded-[6px]' />
            <Bar className='mt-4 h-20 w-full rounded-[10px]' />
            <div className='mt-4 flex gap-2.5'>
                <Bar className='h-11 w-40 rounded-[10px]' />
                <Bar className='h-11 w-36 rounded-[10px]' />
            </div>
        </div>
    );
}
