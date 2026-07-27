import { CollectionsListView } from '@/components/collections/collections-list-view';

export default function CollectionsPage() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
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
