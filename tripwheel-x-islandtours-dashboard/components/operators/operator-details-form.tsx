'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateOperator } from '@/hooks/operators/use-operators';
import { useRole } from '@/contexts/role-context';
import type { OperatorDetail, OperatorVerificationStatus } from '@/types/operator';
import { OPERATOR_VERIFICATION_STATUS_VALUES } from '@/types/operator';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { OperatorDeleteDialog } from './operator-delete-dialog';

const detailsSchema = z.object({
  verificationStatus: z.enum(OPERATOR_VERIFICATION_STATUS_VALUES),
  isActive: z.boolean(),
  contactEmail: z
    .string()
    .optional()
    .refine((v) => !v || z.email().safeParse(v).success, 'Must be a valid email'),
  contactPhone: z.string().optional(),
});

type DetailsFormValues = z.infer<typeof detailsSchema>;

const STATUS_LABEL: Record<OperatorVerificationStatus, string> = {
  UNVERIFIED: 'Unverified',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

interface OperatorDetailsFormProps {
  operator: OperatorDetail;
}

export function OperatorDetailsForm({ operator }: OperatorDetailsFormProps) {
  const router = useRouter();
  const { can } = useRole();
  const canManage = can('MANAGE_OPERATORS');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { mutate: updateOperator, isPending } = useUpdateOperator();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      verificationStatus: operator.verificationStatus,
      isActive: operator.isActive,
      contactEmail: operator.contactEmail ?? '',
      contactPhone: operator.contactPhone ?? '',
    },
  });

  const verificationValue = watch('verificationStatus');
  const isActiveValue = watch('isActive');

  function onSubmit(values: DetailsFormValues) {
    updateOperator(
      {
        id: operator.id,
        payload: {
          verificationStatus: values.verificationStatus,
          isActive: values.isActive,
          contactEmail: values.contactEmail || null,
          contactPhone: values.contactPhone || null,
        },
      },
      {
        onSuccess: () => toast.success('Operator updated successfully.'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to update operator.'),
      }
    );
  }

  const rating =
    operator.aggregateRating != null
      ? `${operator.aggregateRating.toFixed(1)} (${operator.aggregateReviewCount} reviews)`
      : 'No reviews yet';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-8">
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <ReadOnlyRow label="Contact Name" value={operator.user.name} />
            <ReadOnlyRow label="Login Email" value={operator.user.email} />
            <ReadOnlyRow label="Total Bookings" value={String(operator.totalBookings)} />
            <ReadOnlyRow label="Rating" value={rating} />
            <ReadOnlyRow
              label="Cancellation Rate (90d)"
              value={`${operator.cancellationRate90d}%`}
            />
            <ReadOnlyRow
              label="Current Status"
              value={`${operator.isActive ? 'Active' : 'Inactive'} · ${STATUS_LABEL[operator.verificationStatus]}`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-8">
          <CardTitle>Management</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Field>
              <Label className="text-xs font-semibold uppercase">Verification Status</Label>
              <Select
                value={verificationValue}
                onValueChange={(v) =>
                  setValue('verificationStatus', v as OperatorVerificationStatus, {
                    shouldValidate: true,
                  })
                }
                disabled={!canManage}
              >
                <SelectTrigger aria-invalid={!!errors.verificationStatus}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {OPERATOR_VERIFICATION_STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Controls whether the operator&apos;s tours can be published and ranked.
              </FieldDescription>
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <Label className="text-xs font-semibold uppercase">Support Email</Label>
                <Input
                  type="email"
                  {...register('contactEmail')}
                  placeholder="support@company.com"
                  aria-invalid={!!errors.contactEmail}
                  disabled={!canManage}
                />
                <FieldError>{errors.contactEmail?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Support Phone</Label>
                <Input
                  {...register('contactPhone')}
                  placeholder="+5999 123 4567"
                  disabled={!canManage}
                />
              </Field>
            </div>

            <Field>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={isActiveValue}
                  onCheckedChange={(checked) => setValue('isActive', !!checked)}
                  disabled={!canManage}
                />
                <Label htmlFor="isActive" className="text-xs font-semibold uppercase cursor-pointer">
                  Active
                </Label>
              </div>
              <FieldDescription>
                Inactive operators and their tours are hidden from the public site.
              </FieldDescription>
            </Field>

            {canManage && (
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {canManage && (
        <Card className="border-destructive/30 ring-destructive/10">
          <CardHeader className="border-b pb-8">
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Delete this operator</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently removes the operator account and profile. Operators with
                  existing tours or bookings cannot be deleted - deactivate them instead.
                </p>
              </div>
              <div className="shrink-0">
                <Button variant="destructive" size="sm" type="button" onClick={() => setDeleteOpen(true)}>
                  <Trash2Icon />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <OperatorDeleteDialog
          operator={{
            id: operator.id,
            user: { name: operator.user.name },
            companyInfo: operator.companyInfo,
          }}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onSuccess={() => router.push('/tour-operators')}
        />
      )}
    </div>
  );
}
