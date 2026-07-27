import { OperatorsListView } from '@/components/operators/operators-list-view';

export default function TourOperatorsPage() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Tour Operators
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage tour operator accounts
          </p>
        </div>
      </div>
      <OperatorsListView />
    </div>
  );
}
