import { SettingsCardSkeleton } from '@/components/settings/settings-fields';

/** Suspense boundary for the Email Settings segment. */
export default function EmailSettingsLoading() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Email Settings</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        The switchboard: group switches, addresses, schedule
                        timings and the send window. Booking emails are
                        contractual and always on.
                    </p>
                </div>
            </div>
            <div className='max-w-3xl'>
                <SettingsCardSkeleton />
            </div>
        </div>
    );
}
