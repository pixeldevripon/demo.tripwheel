import { Skeleton } from '@/components/ui/skeleton';

/**
 * The default Suspense boundary for EVERY route under `(app)` that does not
 * ship its own `loading.tsx` (Bookings, Payments and Cancellation Requests
 * override it with table-shaped skeletons).
 *
 * Its job is to make navigation commit immediately. Without a boundary the
 * App Router holds the current page on screen until the next segment's RSC
 * payload has fully resolved, which is what made every sidebar click feel like
 * a freeze followed by a jump. Only `children` are replaced - the sidebar and
 * header belong to the layout and stay put, so the shell never flashes.
 *
 * Deliberately generic: it covers a dozen different pages, so it reserves the
 * common anatomy (title block + content surface) rather than pretending to
 * know any one page's layout. Pages with a distinctive shape should add their
 * own `loading.tsx` next to `page.tsx`.
 */
export default function DashboardSegmentLoading() {
    return (
        <div>
            <div className='flex items-center justify-between mb-6'>
                <div className='space-y-2'>
                    <Skeleton className='h-8 w-56' />
                    <Skeleton className='h-4 w-80' />
                </div>
                <Skeleton className='h-9 w-32' />
            </div>
            <Skeleton className='h-96 w-full rounded-lg' />
        </div>
    );
}
