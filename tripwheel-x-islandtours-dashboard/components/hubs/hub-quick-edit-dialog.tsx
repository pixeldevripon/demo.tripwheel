'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError } from '@/components/ui/field';
import { useUpdateHub } from '@/hooks/hubs/use-hubs';
import type { HubLocalized } from '@/types/hub';

const quickEditSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  isActive: z.boolean(),
});

type QuickEditFormValues = z.infer<typeof quickEditSchema>;

interface HubQuickEditDialogProps {
  hub: HubLocalized;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HubQuickEditDialog({ hub, open, onOpenChange }: HubQuickEditDialogProps) {
  const { mutate: updateHub, isPending } = useUpdateHub();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuickEditFormValues>({
    resolver: zodResolver(quickEditSchema),
    defaultValues: {
      name: hub.name,
      description: hub.description ?? '',
      isActive: hub.isActive,
    },
  });

  const isActiveValue = watch('isActive');

  useEffect(() => {
    if (open) {
      reset({
        name: hub.name,
        description: hub.description ?? '',
        isActive: hub.isActive,
      });
    }
  }, [open, hub, reset]);

  function onSubmit(values: QuickEditFormValues) {
    updateHub(
      {
        id: hub.id,
        payload: {
          name: values.name,
          description: values.description || null,
          isActive: values.isActive,
        },
      },
      {
        onSuccess: () => {
          toast.success('Hub updated successfully.');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to update hub.');
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Edit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <Label>Name</Label>
            <Input {...register('name')} placeholder="Hub name" aria-invalid={!!errors.name} />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>

          <Field>
            <Label>Description</Label>
            <Textarea
              {...register('description')}
              placeholder="Brief description of this hub"
              rows={3}
            />
          </Field>

          <Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={isActiveValue}
                onCheckedChange={(checked) => setValue('isActive', !!checked)}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active
              </Label>
            </div>
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
