import { DestinationsListView } from '@/components/destinations/destinations-list-view';

export default function DestinationsPage() {
  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
            Destinations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Caribbean island destinations
          </p>
        </div>
      </div>
      <DestinationsListView />
    </div>
  );
}
