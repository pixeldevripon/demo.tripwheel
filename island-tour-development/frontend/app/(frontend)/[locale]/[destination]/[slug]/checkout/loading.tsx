import { CheckoutPageSkeleton } from '@/components/frontend/skeletons/checkout-page-skeleton';

/**
 * Checkout route skeleton - renders the shared `CheckoutPageSkeleton` (back
 * bar, step band, form + summary grid) so navigation never flashes the
 * tour-detail skeleton from the parent `[slug]/loading.tsx`. The same skeleton
 * is the page's `<Suspense>` fallback, so first paint and streamed fill-in are
 * pixel-identical.
 */
export default function CheckoutLoading() {
    return (
        <section className='it-section !pt-0 bg-white'>
            <CheckoutPageSkeleton />
        </section>
    );
}
