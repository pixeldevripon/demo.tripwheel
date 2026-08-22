import { ListPageSkeleton } from '@/components/skeletons/list-page-skeleton';

/** Suspense boundary for the Email Activity segment. */
export default function EmailActivityLoading() {
    return (
        <ListPageSkeleton
            title='Email Activity'
            description='Every email the platform sent, failed or deliberately suppressed - bookings, onboarding, marketing and internal alerts in one log.'
            columns={6}
            filters={4}
        />
    );
}
