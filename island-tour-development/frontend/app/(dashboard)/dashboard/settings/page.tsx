import { SettingsClient } from '@/components/dashboard/settings/settings-client';

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and platform configuration.
        </p>
      </div>
      <SettingsClient />
    </div>
  );
}
