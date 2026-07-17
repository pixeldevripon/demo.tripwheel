import { StoreIcon } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import { OperatorCreateForm } from '@/components/operators/operator-create-form';

export default function NewTourOperatorPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Tour Operators', href: '/tour-operators' },
          { label: 'New Operator' },
        ]}
      />
      <div className="mb-6 flex items-center gap-3">
        <StoreIcon className="size-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold uppercase tracking-wider">
          New Tour Operator
        </h1>
      </div>
      <div className="max-w-6xl">
        <OperatorCreateForm />
      </div>
    </div>
  );
}
