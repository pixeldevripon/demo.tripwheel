import { OperatorsListView } from '@/components/operators/operators-list-view';

export default function TourOperatorsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold uppercase tracking-wider">
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
