'use client';

import type { RangePresetId } from '@/lib/analytics/range-presets';
import { useVisibleSections } from '@/hooks/use-visible-section';
import type { DashboardStats } from '@/types/analytics';
import type { UserProfile } from '@/types/profile';
import Statistics from './statistics';

interface PageComponentsProps {
    /** Resolves to `null` when the analytics fetch failed - never to zeros. */
    statsPromise?: Promise<DashboardStats | null>;
    /**
     * Only `SetupGuide` (currently commented out below) ever read this, so the
     * Overview page no longer fetches the full profile just to pass it - that
     * fan-out was blocking the navigation. Re-enabling `SetupGuide` means
     * fetching the profile again, ideally inside its own Suspense boundary so
     * it streams rather than holding up the page.
     */
    loggedInUser?: UserProfile;
    /** The range the server fetched with, so the control renders selected. */
    rangePreset: RangePresetId;
    /** That range in words, resolved server-side so it cannot drift. */
    rangeLabel: string;
}

export default function PageComponents({
    statsPromise,
    loggedInUser,
    rangePreset,
    rangeLabel,
}: PageComponentsProps) {
    const [visibleSections, setVisibleSections] = useVisibleSections();

    return (
        <div className='space-y-6'>
            {/*          <SectionToggler
                visibleSections={visibleSections}
                setVisibleSections={setVisibleSections}
            /> */}
            {/*         {visibleSections['quick-setup'] && (
                <SetupGuide loggedInUser={loggedInUser} />
            )} */}

            <Statistics
                visibleSections={visibleSections}
                statsPromise={statsPromise}
                rangePreset={rangePreset}
                rangeLabel={rangeLabel}
            />
        </div>
    );
}

