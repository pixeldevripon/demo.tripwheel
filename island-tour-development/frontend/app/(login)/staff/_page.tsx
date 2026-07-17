import type { Metadata } from 'next';
import { StaffLogin } from '@/components/frontend/login/staff-login';

// Admin surface: noindex, linked from nowhere (spec 4.1).
export const metadata: Metadata = {
    title: 'Staff access | Island Tours',
    robots: { index: false, follow: false },
};

export default function StaffLoginPage() {
    return <StaffLogin />;
}
