'use client';

import { useVisibleSections } from '@/hooks/use-visible-section';
import type { DashboardStats } from '@/types/analytics';
import type { UserProfile } from '@/types/profile';
import Statistics from './statistics';

interface PageComponentsProps {
    /** Resolves to `null` when the analytics fetch failed - never to zeros. */
    statsPromise?: Promise<DashboardStats | null>;
    loggedInUser: UserProfile;
}

export default function PageComponents({
    statsPromise,
    loggedInUser,
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
            />
        </div>
    );
}

