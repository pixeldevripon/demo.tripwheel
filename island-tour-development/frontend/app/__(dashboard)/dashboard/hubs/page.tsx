import { HubsListView } from '@/components/dashboard/hubs/hubs-list-view';

export default function HubsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">Hubs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage destination-specific hub locations
          </p>
        </div>
      </div>
      <HubsListView />
    </div>
  );
}
