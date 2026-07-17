import { LayersIcon } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import { CollectionForm } from '@/components/collections/collection-form';

export default function NewCollectionPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Collections', href: '/collections' },
          { label: 'New' },
        ]}
      />

      <div className="flex items-center gap-2 mb-6">
        <LayersIcon className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">
          Add Collection
        </h1>
      </div>

      <div className="max-w-6xl">
        <CollectionForm />
      </div>
    </div>
  );
}
