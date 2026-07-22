import { ReviewsListView } from '@/components/reviews/reviews-list-view';

/**
 * Reviews moderation queue.
 *
 * A synchronous server shell - data lands via TanStack Query in the client view,
 * the same as every other list page. No `lg:p-8`: the layout wrapper adds it.
 */
export default function ReviewsPage() {
    return (
        <div>
            <div className='mb-6 flex items-center justify-between'>
                <div>
                    <h1 className='font-heading text-2xl font-semibold tracking-wider uppercase'>
                        Reviews
                    </h1>
                    <p className='mt-1 text-sm text-muted-foreground'>
                        Every review comes from a confirmed booking. Publish the
                        good and the bad - reviews are removed only on documented
                        policy grounds, never for being negative.
                    </p>
                </div>
            </div>
            <ReviewsListView />
        </div>
    );
}
