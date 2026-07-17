import type { Metadata } from 'next';
import { OperatorApply } from '@/components/frontend/login/operator-apply';

// Public marketing lead page (indexable, unlike the login surfaces).
export const metadata: Metadata = {
    title: 'Apply to list your tours | Island Tours',
    description:
        'Apply to list your tours on Island Tours. We onboard Caribbean tour operators by invitation.',
};

export default function ApplyPage() {
    return <OperatorApply />;
}
