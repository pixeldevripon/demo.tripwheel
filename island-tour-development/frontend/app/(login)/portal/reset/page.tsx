import type { Metadata } from 'next';
import { OperatorReset } from '@/components/frontend/login/operator-reset';

export const metadata: Metadata = {
    title: 'Reset password | Island Tours operator portal',
    robots: { index: false, follow: false },
};

export default async function OperatorResetPage({
    searchParams,
}: {
    searchParams: Promise<{ state?: string }>;
}) {
    const { state } = await searchParams;
    return <OperatorReset expired={state === 'expired'} />;
}
