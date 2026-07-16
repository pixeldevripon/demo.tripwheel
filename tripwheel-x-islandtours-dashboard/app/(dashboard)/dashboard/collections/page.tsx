import { CollectionsListView } from '@/components/collections/collections-list-view';

export default function CollectionsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
            Collections
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Curated &amp; dynamic editorial tour lists per destination
          </p>
        </div>
      </div>
      <CollectionsListView />
    </div>
  );
}
