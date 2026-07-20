import type { Metadata } from 'next';
import { AccountLogin } from '@/components/login/account-login';

// Traveler surface: noindex - reached from booking/welcome emails, not search.
export const metadata: Metadata = {
    title: 'Your bookings | Island Tours',
    robots: { index: false, follow: false },
};

export default function AccountLoginPage() {
    return <AccountLogin />;
}
