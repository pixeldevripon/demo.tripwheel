import type { Metadata } from 'next';
import { AdminForgot } from '@/components/login/admin-forgot';

export const metadata: Metadata = {
    title: 'Forgot password | Island Tours admin',
    robots: { index: false, follow: false },
};

export default function AdminForgotPage() {
    return <AdminForgot />;
}
