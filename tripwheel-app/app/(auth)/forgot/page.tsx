import type { Metadata } from 'next';

import { ForgotForm } from '@/components/marketing/forgot-form';

export const metadata: Metadata = {
    title: 'Forgot password',
    description: 'Request a password reset link for your TripWheel account.',
    alternates: { canonical: '/forgot' },
    robots: { index: false, follow: true },
};

/** Forgot door - the shared (auth) layout supplies the promo panel. */
export default function ForgotPage() {
    return <ForgotForm />;
}
