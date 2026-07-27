import { DestinationsListView } from '@/components/destinations/destinations-list-view';

export default function DestinationsPage() {
  return (
    <div className="">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
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
