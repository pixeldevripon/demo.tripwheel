import { TripsListView } from '@/components/dashboard/trips/trips-list-view';

export default function TripsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">My Trips</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your tour listings</p>
        </div>
      </div>
      <TripsListView />
    </div>
  );
}
