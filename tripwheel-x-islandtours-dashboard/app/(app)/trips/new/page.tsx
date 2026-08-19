import { Suspense } from 'react';

import { TripWizard } from '@/components/trips/wizard/trip-wizard';

/**
 * Creating a tour starts here and continues on `/trips/[id]/edit` - step 1
 * mints the draft and replaces the URL, because every later step writes to a
 * child collection that needs the row to exist first (07 §1).
 *
 * `TripWizard` reads `useSearchParams`, so it needs a Suspense boundary.
 */
export default function NewTripPage() {
    return (
        <Suspense>
            <TripWizard />
        </Suspense>
    );
}
