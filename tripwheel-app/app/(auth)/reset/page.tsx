import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ResetForm } from '@/components/marketing/reset-form';

export const metadata: Metadata = {
    title: 'Reset password',
    description: 'Set a new password for your TripWheel account.',
    alternates: { canonical: '/reset' },
    robots: { index: false, follow: true },
};

/**
 * Reset door - the shared (auth) layout supplies the promo panel. ResetForm
 * reads the ?token= query param, so it must render inside Suspense.
 */
export default function ResetPage() {
    return (
        <Suspense fallback={null}>
            <ResetForm />
        </Suspense>
    );
}
