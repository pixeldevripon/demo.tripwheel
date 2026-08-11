import { EmailActivityView } from '@/components/email-centre/email-activity-view';

export default function EmailActivityPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Email Activity</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Every email the platform sent, failed or deliberately
                        suppressed - bookings, onboarding, marketing and
                        internal alerts in one log.
                    </p>
                </div>
            </div>
            <EmailActivityView />
        </div>
    );
}
