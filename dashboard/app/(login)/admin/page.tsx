import type { Metadata } from 'next';
import { AdminLogin } from '@/components/login/admin-login';

// Admin surface: noindex, linked from nowhere (spec 4.1).
export const metadata: Metadata = {
    title: 'Admin access | Island Tours',
    robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
    return <AdminLogin />;
}
