import { Breadcrumb } from '@/components/breadcrumb';
import { TripCreateForm } from '@/components/trips/create/trip-create-form';

export default function NewTripPage() {
  return (
    <div className="w-full max-w-2xl">
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'My Trips', href: '/trips' },
          { label: 'New Trip' },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">New Trip</h1>
        <p className="text-sm text-content-muted mt-1">Create a new tour listing</p>
      </div>
      <div>
        <TripCreateForm />
      </div>
    </div>
  );
}
