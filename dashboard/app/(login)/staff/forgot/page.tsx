import type { Metadata } from 'next';
import { StaffForgot } from '@/components/login/staff-forgot';

export const metadata: Metadata = {
    title: 'Forgot password | Island Tours staff',
    robots: { index: false, follow: false },
};

export default function StaffForgotPage() {
    return <StaffForgot />;
}
