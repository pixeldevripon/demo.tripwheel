import { SlidersHorizontalIcon } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import { AttributeForm } from '@/components/attributes/attribute-form';

export default function NewAttributePage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Attributes', href: '/attributes' },
          { label: 'New' },
        ]}
      />

      <div className="flex items-center gap-2 mb-6">
        <SlidersHorizontalIcon className="size-5 text-muted-foreground" />
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
          Add Attribute
        </h1>
      </div>

      <div className="max-w-6xl">
        <AttributeForm />
      </div>
    </div>
  );
}
