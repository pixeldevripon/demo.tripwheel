import { AttributesListView } from '@/components/dashboard/attributes/attributes-list-view';

export default function AttributesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
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
