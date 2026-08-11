/**
 * Placeholder for the streamed unsubscribe card (`/unsubscribe/[token]`).
 * Lives here (not inline in the page) so the route's `loading.tsx` and the
 * page's Suspense fallback render the IDENTICAL silhouette - title, the
 * two-line explanation, the masked address, one button - at the card's
 * real width.
 */
import { Bar } from './skeleton-bar';

export function UnsubscribeCardSkeleton() {
    return (
        <div className='w-full max-w-xl rounded-[16px] bg-it-white p-8 sm:p-12'>
            <Bar className='mx-auto h-7 w-2/3 rounded-it-xs' />
            <Bar className='mx-auto mt-4 h-4 w-full rounded-it-xs' />
            <Bar className='mx-auto mt-2 h-4 w-5/6 rounded-it-xs' />
            <Bar className='mx-auto mt-5 h-4 w-1/2 rounded-it-xs' />
            <Bar className='mx-auto mt-8 h-[50px] w-56 rounded-it-full' />
        </div>
    );
}
