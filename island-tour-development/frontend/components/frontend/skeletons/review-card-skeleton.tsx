/**
 * Placeholder for the streamed review-invitation card (`/review/[token]`).
 * Lives here (not inline in the page) so the route's `loading.tsx` and the
 * page's Suspense fallback render the IDENTICAL silhouette - hero image
 * block, tour title, subtitle, five star slots - at the card's real width.
 */
export function ReviewCardSkeleton() {
    return (
        <div className='w-full max-w-xl animate-pulse rounded-[16px] bg-it-white p-6 sm:p-8'>
            <div className='h-40 w-full rounded-[12px] bg-it-border' />
            <div className='mt-5 h-7 w-3/4 rounded-[6px] bg-it-border' />
            <div className='mt-2 h-4 w-1/2 rounded-[6px] bg-it-border' />
            <div className='mt-5 flex gap-2'>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className='size-8 rounded-[6px] bg-it-border' />
                ))}
            </div>
        </div>
    );
}
