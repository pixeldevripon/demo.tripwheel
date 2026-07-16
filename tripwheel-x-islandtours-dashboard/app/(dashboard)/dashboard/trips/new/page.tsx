import { TripForm } from '@/components/trips/trip-form';
import { Breadcrumb } from '@/components/breadcrumb';

export default function NewTripPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'My Trips', href: '/dashboard/trips' },
          { label: 'New Trip' },
        ]}
      />
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">New Trip</h1>
        <p className="text-sm text-muted-foreground mt-1">Create a new tour listing</p>
      </div>
      <div className="max-w-6xl">
        <TripForm />
      </div>
    </div>
  );
}
