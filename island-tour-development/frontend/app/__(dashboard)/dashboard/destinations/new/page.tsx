import { MapPinIcon } from 'lucide-react';
import { Breadcrumb } from '@/components/dashboard/breadcrumb';
import { DestinationForm } from '@/components/dashboard/destinations/destination-form';

export default function NewDestinationPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Destinations', href: '/dashboard/destinations' },
          { label: 'New' },
        ]}
      />

      <div className="flex items-center gap-2 mb-6">
        <MapPinIcon className="size-5 text-muted-foreground" />
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
          Add Destination
        </h1>
      </div>

      <div className="max-w-6xl">
        <DestinationForm />
      </div>
    </div>
  );
}
