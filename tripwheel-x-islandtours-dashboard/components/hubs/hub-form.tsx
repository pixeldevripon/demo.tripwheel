'use client';

import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ImageSelectorField } from '@/components/media/image-selector-field';
import { useCreateHub, useUpdateHub } from '@/hooks/hubs/use-hubs';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import type { HubDetail } from '@/types/hub';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldAlertIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { HubDeleteDialog } from './hub-delete-dialog';
import { useRole } from '@/contexts/role-context';
import { HUB_TYPE_VALUES } from '@/types/enums';

const hubSchema = z.object({
  destinationId: z.string().min(1, 'Destination is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  // Optional + empty-tolerant: hub create has no slug field (backend auto-generates
  // it), so an empty value must pass. On edit the field is rendered and pre-filled,
  // and the format/length checks apply to any non-empty value.
  slug: z
    .string()
    .optional()
    .refine(v => !v || /^[a-z0-9-]+$/.test(v), 'Slug may only contain lowercase letters, numbers, and hyphens')
    .refine(v => !v || v.length >= 2, 'Slug must be at least 2 characters'),
  description: z.string().optional(),
  heroImage: z.string().optional(),
  hubType: z.enum(HUB_TYPE_VALUES as [string, ...string[]], { message: 'Hub type is required' }),
  latitude: z
    .string()
    .optional()
    .refine(v => !v || (!isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90), 'Latitude must be between -90 and 90'),
  longitude: z
    .string()
    .optional()
    .refine(v => !v || (!isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180), 'Longitude must be between -180 and 180'),
  isActive: z.boolean().optional(),
});

type HubFormValues = z.infer<typeof hubSchema>;

interface HubFormProps {
  hub?: HubDetail;
  onSuccess?: (hub: HubDetail) => void;
}

export function HubForm({ hub, onSuccess }: HubFormProps) {
  const router = useRouter();
  const isEditMode = !!hub;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { mutate: createHub, isPending: isCreating } = useCreateHub();
  const { mutate: updateHub, isPending: isUpdating } = useUpdateHub();
  const isPending = isCreating || isUpdating;
  const { can } = useRole();

  const { data: destinations = [], isLoading: isLoadingDestinations } = useActiveDestinations('en');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HubFormValues>({
    resolver: zodResolver(hubSchema),
    defaultValues: {
      destinationId: hub?.destinationId ?? '',
      name: hub?.name ?? '',
      slug: hub?.slug ?? '',
      description: hub?.description ?? '',
      heroImage: hub?.heroImage ?? '',
      hubType: hub?.hubType ?? undefined,
      latitude: hub?.latitude?.toString() ?? '',
      longitude: hub?.longitude?.toString() ?? '',
      isActive: hub?.isActive ?? true,
    },
  });

  const isActiveValue = watch('isActive');
  const destinationIdValue = watch('destinationId');
  const hubTypeValue = watch('hubType');
  const heroImageValue = watch('heroImage');

  const num = (v: string | undefined) =>
    v === '' || v === undefined ? null : Number(v);

  function onSubmit(values: HubFormValues) {
    if (isEditMode && hub) {
      updateHub(
        {
          id: hub.id,
          payload: {
            name: values.name,
            // Omit when blank so the backend never attempts an empty rename.
            slug: values.slug || undefined,
            description: values.description || null,
            // null when cleared (backend @IsUrl skips null via @IsOptional).
            heroImage: values.heroImage || null,
            hubType: values.hubType as HubDetail['hubType'] ?? undefined,
            latitude: num(values.latitude),
            longitude: num(values.longitude),
            isActive: values.isActive,
          },
        },
        {
          onSuccess: (updated) => {
            toast.success('Hub updated successfully.');
            onSuccess?.(updated);
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to update hub.');
          },
        }
      );
    } else {
      createHub(
        {
          destinationId: values.destinationId,
          name: values.name,
          description: values.description || null,
          heroImage: values.heroImage || null,
          hubType: values.hubType as NonNullable<HubDetail['hubType']>,
          latitude: num(values.latitude),
          longitude: num(values.longitude),
        },
        {
          onSuccess: (created) => {
            toast.success('Hub created successfully.');
            onSuccess?.(created);
            router.push(`/hubs/${created.id}/edit`);
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to create hub.');
          },
        }
      );
    }
  }

  const selectedDestinationName = destinations.find((d) => d.id === destinationIdValue)?.name;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-8">
          <CardTitle>Hub Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Field>
              <Label className="text-xs font-semibold uppercase">
                Destination <span className="text-destructive">*</span>
              </Label>
              {isEditMode ? (
                <Input
                  value={selectedDestinationName ?? hub?.destinationId ?? ''}
                  readOnly
                  className="opacity-60 cursor-not-allowed"
                />
              ) : isLoadingDestinations ? (
                <Skeleton className="h-9 w-full rounded-none" />
              ) : (
                <Select
                  value={destinationIdValue}
                  onValueChange={(val) => setValue('destinationId', val, { shouldValidate: true })}
                >
                  <SelectTrigger aria-invalid={!!errors.destinationId}>
                    <SelectValue placeholder="Select a destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isEditMode && (
                <FieldDescription>Destination cannot be changed after creation.</FieldDescription>
              )}
              <FieldError>{errors.destinationId?.message}</FieldError>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('name')}
                placeholder="e.g. Klein Curaçao"
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>

            {isEditMode && (
              <Field>
                <Label className="text-xs font-semibold uppercase">Slug</Label>
                <Input
                  {...register('slug')}
                  placeholder="e.g. klein-curacao"
                  aria-invalid={!!errors.slug}
                />
                <FieldDescription>
                  Renaming the slug issues an automatic 301 redirect; the old slug is reserved
                  for a 90-day cooldown before it can be reused.
                </FieldDescription>
                <FieldError>{errors.slug?.message}</FieldError>
              </Field>
            )}

            <Field>
              <Label className="text-xs font-semibold uppercase">Description</Label>
              <Textarea
                {...register('description')}
                placeholder="Brief description of this hub location"
                rows={4}
              />
              <FieldDescription>
                Short description shown in hub listings and previews.
              </FieldDescription>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Hero Image</Label>
              <ImageSelectorField
                value={heroImageValue || null}
                onChange={(url) => setValue('heroImage', url ?? '')}
              />
              <FieldDescription>
                Full-bleed hero - the hub&apos;s defining visual. Required before the hub can be
                published.
              </FieldDescription>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">
                Hub Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={hubTypeValue ?? ''}
                onValueChange={v => setValue('hubType', v, { shouldValidate: true })}>
                <SelectTrigger aria-invalid={!!errors.hubType}>
                  <SelectValue placeholder="Select a hub type" />
                </SelectTrigger>
                <SelectContent>
                  {HUB_TYPE_VALUES.map(t => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{errors.hubType?.message}</FieldError>
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <Label className="text-xs font-semibold uppercase">Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  {...register('latitude')}
                  placeholder="e.g. 11.9833"
                  aria-invalid={!!errors.latitude}
                />
                <FieldError>{errors.latitude?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  {...register('longitude')}
                  placeholder="e.g. -68.6500"
                  aria-invalid={!!errors.longitude}
                />
                <FieldError>{errors.longitude?.message}</FieldError>
              </Field>
            </div>

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
                <FieldDescription>Inactive hubs are hidden from the public site.</FieldDescription>
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
                    : 'Create Hub'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isEditMode && hub && can('MANAGE_HUBS') && (
        <Card className="border-destructive/30 ring-destructive/10">
          <CardHeader className="border-b pb-8">
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Deactivate this hub</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Hides this hub from the public site. The record is preserved
                  to protect its URL slug and associated trip data.
                </p>
                {hub.isSeeded && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-warning-fg">
                    <ShieldAlertIcon className="size-4 shrink-0" />
                    <span>This is a seeded hub and is protected from deletion.</span>
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {hub.isSeeded ? (
                  <Badge variant="secondary">Protected</Badge>
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

      {isEditMode && hub && can('MANAGE_HUBS') && (
        <HubDeleteDialog
          hub={hub}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onSuccess={() => router.push('/hubs')}
        />
      )}
    </div>
  );
}
