import { HugeiconsIcon } from '@hugeicons/react';
import { FilterHorizontalIcon } from '@hugeicons/core-free-icons';
import { Breadcrumb } from '@/components/breadcrumb';
import { AttributeForm } from '@/components/attributes/attribute-form';

export default function NewAttributePage() {
  return (
    <div className="w-full max-w-6xl">
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Attributes', href: '/attributes' },
          { label: 'New' },
        ]}
      />

      <div className="flex items-center gap-2 mb-6">
        <HugeiconsIcon icon={FilterHorizontalIcon} className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">
          Add Attribute
        </h1>
      </div>

      <div>
        <AttributeForm />
      </div>
    </div>
  );
}
