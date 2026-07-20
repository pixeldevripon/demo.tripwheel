import type { Metadata } from 'next';
import { AccountForgot } from '@/components/login/account-forgot';

export const metadata: Metadata = {
    title: 'Forgot password | Island Tours',
    robots: { index: false, follow: false },
};

export default function AccountForgotPage() {
    return <AccountForgot />;
}
