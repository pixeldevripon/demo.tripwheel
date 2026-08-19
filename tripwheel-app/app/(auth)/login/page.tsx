import type { Metadata } from 'next';

import { LoginForm } from '@/components/marketing/login-form';

export const metadata: Metadata = {
    title: 'Log in',
    description:
        'Log in to TripWheel to manage bookings, itineraries, payments, and growth analytics for your travel agency.',
    alternates: { canonical: '/login' },
    // Standard practice for auth doors: reachable, but kept out of the index -
    // the landing page is the surface that should rank.
    robots: { index: false, follow: true },
    openGraph: {
        title: 'Log in to TripWheel',
        description:
            'Access your TripWheel workspace - bookings, itineraries, payments, and growth analytics in one place.',
        url: '/login',
    },
};

/** Login door - the shared (auth) layout supplies the promo panel. */
export default function LoginPage() {
    return <LoginForm />;
}
