'use client';

import { ErrorScreen } from '@/components/frontend/status/error-screen';

/**
 * The last-resort error boundary, one level above every route group. It catches
 * what the nested boundaries cannot: a failure in the public-site layout itself
 * (`(frontend)/layout.tsx` or `[locale]/layout.tsx` - typically the navbar,
 * footer or site-settings fetch), and anything thrown on the locale-free login
 * surfaces.
 *
 * Because the layout that failed is gone, this brings its own `.frontend-root`
 * and fills the viewport. Only a failure in the ROOT layout gets past this one,
 * and that is `global-error.tsx`.
 */
export default function RootError({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}) {
    return (
        <div className='frontend-root flex flex-1 flex-col'>
            <ErrorScreen error={error} retry={unstable_retry} fill='viewport' />
        </div>
    );
}
