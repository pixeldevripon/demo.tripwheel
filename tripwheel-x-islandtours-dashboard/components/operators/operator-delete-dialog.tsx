'use client';

import { toast } from 'sonner';
import { useDeleteOperator } from '@/hooks/operators/use-operators';
import { getOperatorDisplayName } from '@/types/operator';
import { ForceDeleteDialog } from '@/components/common/force-delete-dialog';

interface OperatorDeleteDialogProps {
  operator: {
    id: string;
    user: { name: string };
    companyInfo: { companyName: string | null } | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function OperatorDeleteDialog({
  operator,
  open,
  onOpenChange,
  onSuccess,
}: OperatorDeleteDialogProps) {
  const { mutate: deleteOperator, isPending } = useDeleteOperator();
  const name = getOperatorDisplayName(operator);

  function handleConfirm() {
    deleteOperator(operator.id, {
      onSuccess: () => {
        toast.success(`"${name}" deleted successfully.`);
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to delete operator.');
      },
    });
  }

  return (
    <ForceDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Operator"
      entityName={name}
      consequenceNote="This permanently removes the operator account and profile. Operators with existing tours or bookings cannot be deleted - deactivate them instead."
      onConfirm={handleConfirm}
      isPending={isPending}
    />
  );
}
