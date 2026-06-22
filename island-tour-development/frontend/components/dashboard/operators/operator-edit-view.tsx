'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { OperatorDetailShell } from './operator-detail-shell';
import { OperatorDetailsForm } from './operator-details-form';
import { useOperator } from '@/hooks/operators/use-operators';
import { getOperatorDisplayName } from '@/types/operator';

interface OperatorEditViewProps {
  id: string;
}

export function OperatorEditView({ id }: OperatorEditViewProps) {
  const { data: operator, isLoading } = useOperator(id);
  const name = operator ? getOperatorDisplayName(operator) : undefined;

  return (
    <OperatorDetailShell id={id} name={name} isLoading={isLoading} subtitle="Operator details">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-32 w-full rounded-none" />
        </div>
      ) : operator ? (
        <OperatorDetailsForm operator={operator} />
      ) : (
        <p className="text-sm text-muted-foreground">Operator not found.</p>
      )}
    </OperatorDetailShell>
  );
}
