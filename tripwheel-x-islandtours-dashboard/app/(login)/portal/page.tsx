import type { Metadata } from 'next';
import { OperatorLogin } from '@/components/login/operator-login';

export const metadata: Metadata = {
    title: 'Operator portal | Island Tours',
    robots: { index: false, follow: false },
};

export default function OperatorLoginPage() {
    return <OperatorLogin />;
}
