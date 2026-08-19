'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { MailValidation01Icon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateOperator } from '@/hooks/operators/use-operators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const createOperatorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.email('Enter a valid email address'),
});

type CreateOperatorValues = z.infer<typeof createOperatorSchema>;

export function OperatorCreateForm() {
  const router = useRouter();
  const { mutate: createOperator, isPending } = useCreateOperator();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOperatorValues>({
    resolver: zodResolver(createOperatorSchema),
    defaultValues: { name: '', email: '' },
  });

  function onSubmit(values: CreateOperatorValues) {
    createOperator(
      { name: values.name, email: values.email },
      {
        onSuccess: (created) => {
          toast.success('Operator created - an invite email has been sent.');
          router.push(`/tour-operators/${created.id}/edit`);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create operator.');
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-8">
          <CardTitle>Operator Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Field>
              <Label>
                Contact Name <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('name')}
                placeholder="e.g. John Smith"
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>

            <Field>
              <Label>
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                type="email"
                {...register('email')}
                placeholder="operator@company.com"
                aria-invalid={!!errors.email}
              />
              <FieldDescription>
                A set-password invite link is sent to this address. The operator sets
                their own password, then logs in to complete onboarding.
              </FieldDescription>
              <FieldError>{errors.email?.message}</FieldError>
            </Field>

            <div className="flex items-start gap-2 rounded-none bg-muted px-4 py-3 text-sm text-muted-foreground">
              <HugeiconsIcon icon={MailValidation01Icon} className="size-4 shrink-0 mt-0.5" />
              <p>
                No password is set here. The operator receives a secure invite email and
                chooses their own password.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating...' : 'Create & Send Invite'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
