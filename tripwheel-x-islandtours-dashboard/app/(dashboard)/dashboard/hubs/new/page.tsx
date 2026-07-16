import { NavigationIcon } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import { HubForm } from '@/components/hubs/hub-form';

export default function NewHubPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Hubs', href: '/dashboard/hubs' },
          { label: 'New Hub' },
        ]}
      />
      <div className="mb-6 flex items-center gap-3">
        <NavigationIcon className="size-6 text-muted-foreground" />
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">New Hub</h1>
      </div>
      <div className="max-w-6xl">
        <HubForm />
      </div>
    </div>
  );
}
