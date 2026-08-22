'use client';

import { ErrorScreen } from '@/components/frontend/status/error-screen';

/**
 * Error boundary for every public page under `/{locale}`. It sits inside the
 * locale layout, so a failed page keeps the navbar and footer: the traveler can
 * navigate away even when this one route will not render.
 *
 * Failures in the locale layout itself (the navbar/footer data) are NOT caught
 * here - a boundary never wraps the layout of its own segment. Those fall
 * through to `app/error.tsx`.
 */
export default function LocaleError({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}) {
    return <ErrorScreen error={error} retry={unstable_retry} />;
}
