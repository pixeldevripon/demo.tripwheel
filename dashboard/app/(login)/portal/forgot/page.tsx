import type { Metadata } from 'next';
import { OperatorForgot } from '@/components/login/operator-forgot';

export const metadata: Metadata = {
    title: 'Forgot password | Island Tours operator portal',
    robots: { index: false, follow: false },
};

export default function OperatorForgotPage() {
    return <OperatorForgot />;
}
