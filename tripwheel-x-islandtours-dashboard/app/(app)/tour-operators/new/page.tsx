import { HugeiconsIcon } from '@hugeicons/react';
import { Store01Icon } from '@hugeicons/core-free-icons';
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
        <HugeiconsIcon icon={Store01Icon} className="size-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">
          New Tour Operator
        </h1>
      </div>
      <div className="max-w-6xl">
        <OperatorCreateForm />
      </div>
    </div>
  );
}
