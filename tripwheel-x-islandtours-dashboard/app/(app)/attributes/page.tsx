import { AttributesListView } from '@/components/attributes/attributes-list-view';

export default function AttributesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            Attributes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the attribute dictionary used for tour filters and facets
          </p>
        </div>
      </div>
      <AttributesListView />
    </div>
  );
}
