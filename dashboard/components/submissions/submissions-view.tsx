'use client';

import { OperatorSubmissionsView } from '@/components/submissions/operator-submissions-view';
import { SubmissionsQueueView } from '@/components/submissions/submissions-queue-view';
import { useRole } from '@/contexts/role-context';

/**
 * One nav row, two sides of the review desk (UX round 3): the platform
 * decides submissions; an operator tracks what THEY sent and where each
 * piece stands. Header copy states which side you are on.
 */
export function SubmissionsView() {
    const { can } = useRole();
    const isPlatform = can('MANAGE_TRIPS');
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Submissions</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        {isPlatform
                            ? 'Tours submitted for review - approve or request changes before anything goes live'
                            : 'Everything you have sent to Island Tours - new tours and live-content changes - and where each one stands'}
                    </p>
                </div>
            </div>
            {isPlatform ? <SubmissionsQueueView /> : <OperatorSubmissionsView />}
        </div>
    );
}
