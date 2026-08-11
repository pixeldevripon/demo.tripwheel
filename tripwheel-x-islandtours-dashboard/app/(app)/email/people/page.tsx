import { EmailPeopleView } from '@/components/email-centre/email-people-view';

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
