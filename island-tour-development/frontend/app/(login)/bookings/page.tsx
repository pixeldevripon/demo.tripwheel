import type { Metadata } from 'next';
import { TravelerLogin } from '@/components/frontend/login/traveler-login';

// Traveler surface is noindex + excluded from sitemaps (spec 2.1).
export const metadata: Metadata = {
    title: 'Your bookings | Island Tours',
    robots: { index: false, follow: true },
};

export default function BookingsLoginPage() {
    return <TravelerLogin />;
}
