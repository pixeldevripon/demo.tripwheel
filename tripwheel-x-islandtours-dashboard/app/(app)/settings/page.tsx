import { SettingsClient } from '@/components/settings/settings-client';

export default function SettingsPage() {
    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>Settings</h1>
                <p className='text-sm text-muted-foreground mt-1'>
                    Manage your account and platform configuration.
                </p>
            </div>
            <SettingsClient />
        </div>
    );
}

