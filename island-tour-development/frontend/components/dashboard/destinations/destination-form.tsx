'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ImageIcon, Trash2Icon, ShieldAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldDescription } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { useCreateDestination, useUpdateDestination } from '@/hooks/destinations/use-destinations';
import type { DestinationDetail } from '@/types/destination';
import { DestinationDeleteDialog } from './destination-delete-dialog';

const destinationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  heroImage: z.string().refine((v) => v === '' || (() => { try { new URL(v); return true; } catch { return false; } })(), 'Must be a valid URL').optional(),
  isActive: z.boolean().optional(),
});

type DestinationFormValues = z.infer<typeof destinationSchema>;

function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

interface DestinationFormProps {
  destination?: DestinationDetail;
  onSuccess?: (destination: DestinationDetail) => void;
}

export function DestinationForm({ destination, onSuccess }: DestinationFormProps) {
  const router = useRouter();
  const isEditMode = !!destination;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { mutate: createDestination, isPending: isCreating } = useCreateDestination();
  const { mutate: updateDestination, isPending: isUpdating } = useUpdateDestination();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DestinationFormValues>({
    resolver: zodResolver(destinationSchema),
    defaultValues: {
      name: destination?.name ?? '',
      heroImage: destination?.heroImage ?? '',
      isActive: destination?.isActive ?? true,
    },
  });

  const heroImageValue = watch('heroImage');
  const isActiveValue = watch('isActive');
  const showImagePreview = !!heroImageValue && isValidUrl(heroImageValue);

  function onSubmit(values: DestinationFormValues) {
    if (isEditMode && destination) {
      updateDestination(
        {
          id: destination.id,
          payload: {
            name: values.name,
            heroImage: values.heroImage || null,
            isActive: values.isActive,
          },
        },
        {
          onSuccess: (updated) => {
            toast.success('Destination updated successfully.');
            onSuccess?.(updated);
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to update destination.');
          },
        }
      );
    } else {
      createDestination(
        { name: values.name, heroImage: values.heroImage || null },
        {
          onSuccess: (created) => {
            toast.success('Destination created successfully.');
            onSuccess?.(created);
            router.push(`/dashboard/destinations/${created.id}/edit`);
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to create destination.');
          },
        }
      );
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-8">
          <CardTitle>Destination Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Field>
              <Label className="text-xs font-semibold uppercase">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('name')}
                placeholder="e.g. Curaçao"
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Hero Image URL</Label>
              <Input
                {...register('heroImage')}
                placeholder="https://example.com/image.jpg"
                aria-invalid={!!errors.heroImage}
              />
              <FieldError>{errors.heroImage?.message}</FieldError>
              <FieldDescription>
                Link to the destination&apos;s hero banner image.
              </FieldDescription>
              <div className="mt-3 overflow-hidden rounded-none bg-muted">
                {showImagePreview ? (
                  <img
                    src={heroImageValue}
                    alt="Hero preview"
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageIcon className="size-8 opacity-40" />
                    <span className="text-xs">Image preview</span>
                  </div>
                )}
              </div>
            </Field>

            {isEditMode && (
              <Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isActive"
                    checked={isActiveValue}
                    onCheckedChange={(checked) => setValue('isActive', !!checked)}
                  />
                  <Label htmlFor="isActive" className="text-xs font-semibold uppercase cursor-pointer">
                    Active
                  </Label>
                </div>
                <FieldDescription>
                  Inactive destinations are hidden from the public site.
                </FieldDescription>
              </Field>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isEditMode
                    ? 'Saving...'
                    : 'Creating...'
                  : isEditMode
                  ? 'Save Changes'
                  : 'Create Destination'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isEditMode && destination && (
        <Card className="border-destructive/30 ring-destructive/10">
          <CardHeader className="border-b pb-8">
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Delete this destination</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently remove this destination and all associated slug registry entries.
                  This action cannot be undone.
                </p>
                {destination.isSeeded && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
                    <ShieldAlertIcon className="size-4 shrink-0" />
                    <span>
                      This is a seeded destination and is protected from deletion.
                    </span>
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {destination.isSeeded ? (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary">
                      Protected
                    </Badge>
                  </div>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2Icon />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isEditMode && destination && (
        <DestinationDeleteDialog
          destination={destination}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onSuccess={() => router.push('/dashboard/destinations')}
        />
      )}
    </div>
  );
}
