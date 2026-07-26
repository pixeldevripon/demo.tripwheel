import { PagesListView } from '@/components/pages/pages-list-view';

export default function PagesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Pages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Legal &amp; policy pages with their own permalinks on the public site
          </p>
        </div>
      </div>
      <PagesListView />
    </div>
  );
}
