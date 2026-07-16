'use client';

import { useVisibleSections } from '@/hooks/use-visible-section';
import SectionToggler from './section-toggler';
import { SetupGuide } from './setup-guide';
import Statistics from './statistics';

interface PageComponentsProps {
    statsPromise?: Promise<any>;
    loggedInUser: any;
}

export default function PageComponents({ statsPromise, loggedInUser }: PageComponentsProps) {
    const [visibleSections, setVisibleSections] = useVisibleSections();

    return (
        <div className="space-y-6">
            <SectionToggler
                visibleSections={visibleSections}
                setVisibleSections={setVisibleSections}
            />
            {visibleSections['quick-setup'] && (
                <SetupGuide loggedInUser={loggedInUser} />
            )}

            <Statistics
                visibleSections={visibleSections}
                statsPromise={statsPromise}
            />
        </div>
    );
}
