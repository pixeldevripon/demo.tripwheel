import { Suspense } from 'react';

import { TripWizard } from '@/components/trips/wizard/trip-wizard';

interface Props {
    params: Promise<{ id: string }>;
}

/**
 * The trip wizard in edit mode. Position comes from `?step=`, which
 * `resolveStepParam` also resolves from legacy `?tab=` values - so readiness
 * chips, row actions, bookmarks and the e2e specs keep landing on the right
 * screen with no redirect hop (07 §6).
 *
 * A tour that has never been published still walks the wizard forward;
 * anything published before lands on the review hub. That is decided from the
 * trip itself, not from this route.
 */
export default async function EditTripPage({ params }: Props) {
    const { id } = await params;
    return (
        <Suspense>
            <TripWizard tripId={id} />
        </Suspense>
    );
}
