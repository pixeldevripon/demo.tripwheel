import { HugeiconsIcon } from '@hugeicons/react';
import { Location01Icon } from '@hugeicons/core-free-icons';
import { Breadcrumb } from '@/components/breadcrumb';
import { DestinationForm } from '@/components/destinations/destination-form';

export default function NewDestinationPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Destinations', href: '/destinations' },
          { label: 'New' },
        ]}
      />

      <div className="flex items-center gap-2 mb-6">
        <HugeiconsIcon icon={Location01Icon} className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">
          Add Destination
        </h1>
      </div>

      <div className="max-w-6xl">
        <DestinationForm />
      </div>
    </div>
  );
}
