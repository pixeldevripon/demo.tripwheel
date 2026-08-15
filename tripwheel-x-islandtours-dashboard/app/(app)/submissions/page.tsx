import { SubmissionsQueueView } from '@/components/submissions/submissions-queue-view';

/**
 * The publish gate's queue (client review #18): operators submit, Island
 * Tours approves - this page is where pending submissions get spotted and
 * decided. Independent of the Tours list on purpose (client 2026-08-15):
 * its own route, its own content, its own nav row.
 */
export default function SubmissionsPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Submissions</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Tours submitted for review - approve or request changes
                        before anything goes live
                    </p>
                </div>
            </div>
            <SubmissionsQueueView />
        </div>
    );
}
