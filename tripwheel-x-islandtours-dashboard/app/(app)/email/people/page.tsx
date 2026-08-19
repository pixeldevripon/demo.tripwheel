import { EmailPeopleView } from '@/components/email-centre/email-people-view';

/**
 * UNLINKED BY DESIGN (founder request 2026-08-12): this page is no longer in
 * the sidebar or the command palette, but the route stays live and
 * MANAGE_SYSTEM-gated. It is the compliance ledger - the answer to "why did
 * this person not get the email" - so it must remain reachable at
 * /email/people even though nothing links to it day to day.
 */
export default function EmailPeoplePage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Email People</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Who is opted out of which stream, and who consented to
                        marketing - the compliance ledger behind every send
                        decision.
                    </p>
                </div>
            </div>
            <EmailPeopleView />
        </div>
    );
}
