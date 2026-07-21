'use client';

import Link from 'next/link';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon,
  Delete02Icon,
  LayoutTable01Icon,
  PlusSignIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CollapsibleCard } from '@/components/common/collapsible-card';
import { IconTile } from '@/components/common/icon-tile';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useCreatePageContentSection,
  useDeletePageContentSection,
  usePageContentSections,
  useUpdatePageContentSection,
  useUpsertPageContentSectionTranslation,
} from '@/hooks/page-content-sections/use-page-content-sections';
import {
  ALL_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  type Locale,
} from '@/lib/constants/locales';
import type { PageContentSectionGroup } from '@/types/page-content-section';

/** Section basePath → Translation Console entity type (mirrors faq-manager). */
const CONSOLE_TYPE_BY_BASE: Record<string, string> = {
  '/destinations': 'destination',
};

// Backend enforces heading >= 3 (<= 120) and body >= 10 characters.
//
// There is no anchor/link control: these blocks are three columns of copy, not
// in-page navigation (user, 2026-07-21 - the column was dropped from the schema
// entirely rather than left as a field nothing reads).
const sectionContentSchema = z.object({
  heading: z
    .string()
    .min(3, 'Heading must be at least 3 characters')
    .max(120, 'Heading must be 120 characters or fewer'),
  body: z.string().min(10, 'Body must be at least 10 characters'),
});
type SectionContentValues = z.infer<typeof sectionContentSchema>;

// ── Per-locale editor (English base + each translation) ─────────────────────────

interface SectionLocaleEditorProps {
  basePath: string;
  entityId: string;
  groupId: string;
  locale: Locale;
  isBase?: boolean;
  existing?: { heading: string; body: string };
}

function SectionLocaleEditor({
  basePath,
  entityId,
  groupId,
  locale,
  isBase,
  existing,
}: SectionLocaleEditorProps) {
  const { mutate: upsert, isPending } = useUpsertPageContentSectionTranslation(
    basePath,
    entityId,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SectionContentValues>({
    resolver: zodResolver(sectionContentSchema),
    defaultValues: { heading: existing?.heading ?? '', body: existing?.body ?? '' },
  });

  useEffect(() => {
    reset({ heading: existing?.heading ?? '', body: existing?.body ?? '' });
  }, [existing?.heading, existing?.body, reset]);

  function onSubmit(values: SectionContentValues) {
    upsert(
      { groupId, locale, payload: { heading: values.heading, body: values.body } },
      {
        onSuccess: () => toast.success(`${LOCALE_LABELS[locale]} saved.`),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save.'),
      },
    );
  }

  const translated = !!existing?.heading?.trim();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={isBase ? 'default' : translated ? 'secondary' : 'outline'}>
          {isBase ? `${LOCALE_LABELS[locale]} (base)` : LOCALE_LABELS[locale]}
        </Badge>
        {!isBase && !translated && (
          <span className="text-xs text-muted-foreground">Not translated yet</span>
        )}
      </div>
      <Field>
        <Label>Heading</Label>
        <Input {...register('heading')} aria-invalid={!!errors.heading} />
        <FieldError>{errors.heading?.message}</FieldError>
      </Field>
      <Field>
        <Label>Body</Label>
        <Textarea {...register('body')} rows={3} aria-invalid={!!errors.body} />
        <FieldError>{errors.body?.message}</FieldError>
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          <HugeiconsIcon icon={Tick02Icon} />
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

// ── Section card (one logical section = one group) ──────────────────────────────

interface SectionGroupCardProps {
  basePath: string;
  entityId: string;
  group: PageContentSectionGroup;
}

function SectionGroupCard({ basePath, entityId, group }: SectionGroupCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutate: updateGroup, isPending: isUpdating } = useUpdatePageContentSection(
    basePath,
    entityId,
  );
  const { mutate: deleteGroup, isPending: isDeleting } = useDeletePageContentSection(
    basePath,
    entityId,
  );

  const byLocale = new Map(group.translations.map((t) => [t.locale, t]));
  const en = byLocale.get(DEFAULT_LOCALE);
  const translatedCount = group.translations.filter((t) => t.heading?.trim()).length;

  function toggleActive(next: boolean) {
    updateGroup(
      { groupId: group.sectionGroupId, payload: { isActive: next } },
      {
        onSuccess: () => toast.success(next ? 'Section shown.' : 'Section hidden.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update.'),
      },
    );
  }

  function handleDelete() {
    deleteGroup(group.sectionGroupId, {
      onSuccess: () => {
        toast.success('Section deleted.');
        setDeleteOpen(false);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete.'),
    });
  }

  return (
    <>
      <CollapsibleCard
        compact
        leading={<IconTile icon={LayoutTable01Icon} variant="primary" size="sm" />}
        title={<span className="line-clamp-1">{en?.heading ?? '(no English heading)'}</span>}
        meta={
          <span className="flex flex-wrap items-center gap-1.5">
            {en?.body && (
              <span className="line-clamp-1 max-w-96 text-xs font-normal text-content-muted">
                {en.body}
              </span>
            )}
            <StatusBadge variant={group.isActive ? 'success' : 'neutral'}>
              {group.isActive ? 'Active' : 'Hidden'}
            </StatusBadge>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium tabular-nums ${
                translatedCount === ALL_LOCALES.length
                  ? 'bg-success-subtle text-success-fg'
                  : 'bg-warning-subtle text-warning-fg'
              }`}
            >
              {translatedCount}/{ALL_LOCALES.length}
            </span>
          </span>
        }
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-danger-fg hover:bg-danger-subtle hover:text-danger-fg"
            onClick={() => setDeleteOpen(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} />
          </Button>
        }
      >
        <div className="space-y-6">
          {/* Group settings - these apply to every locale row at once. */}
          <div className="flex flex-wrap items-end gap-4">
            <DisplayOrderField
              current={group.displayOrder}
              disabled={isUpdating}
              onSave={(displayOrder) =>
                updateGroup(
                  { groupId: group.sectionGroupId, payload: { displayOrder } },
                  {
                    onSuccess: () => toast.success('Order updated.'),
                    onError: (err) =>
                      toast.error(err instanceof Error ? err.message : 'Failed to update.'),
                  },
                )
              }
            />
            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id={`section-active-${group.sectionGroupId}`}
                checked={group.isActive}
                disabled={isUpdating}
                onCheckedChange={(checked) => toggleActive(!!checked)}
              />
              <Label
                htmlFor={`section-active-${group.sectionGroupId}`}
                className="cursor-pointer"
              >
                Active
              </Label>
            </div>
          </div>

          {/* ENGLISH ONLY, same rule as FaqManager (user decision 2026-07-17):
              the entity page owns add/remove and the English base; the other six
              locales are translated in the Translation Console, which carries
              these sections as its "About sections" block. */}
          <SectionLocaleEditor
            basePath={basePath}
            entityId={entityId}
            groupId={group.sectionGroupId}
            locale={DEFAULT_LOCALE}
            isBase
            existing={(() => {
              const t = byLocale.get(DEFAULT_LOCALE);
              return t ? { heading: t.heading, body: t.body } : undefined;
            })()}
          />
          {/* No link at all beats a wrong one - an unmapped basePath renders no
              pointer rather than guessing an entity type (the bug FaqManager
              already had to fix). */}
          {CONSOLE_TYPE_BY_BASE[basePath] && (
            <p className="text-xs text-content-muted">
              Translate this section into the other languages in the{' '}
              <Link
                href={`/translations/${CONSOLE_TYPE_BY_BASE[basePath]}/${entityId}/es`}
                className="underline underline-offset-4 hover:text-primary"
              >
                Translation Console
              </Link>
              .
            </p>
          )}
        </div>
      </CollapsibleCard>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon icon={Delete02Icon} className="size-8 text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete section</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the section and all of its translations. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Display-order inline field ──────────────────────────────────────────────────

function DisplayOrderField({
  current,
  disabled,
  onSave,
}: {
  current: number;
  disabled: boolean;
  onSave: (value: number) => void;
}) {
  const [value, setValue] = useState(String(current));
  useEffect(() => {
    setValue(String(current));
  }, [current]);

  const dirty = value !== String(current);

  return (
    <div className="flex items-end gap-2">
      <Field>
        <Label>Display Order</Label>
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24"
        />
      </Field>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || !dirty || value === ''}
        onClick={() => onSave(Number(value))}
      >
        Save
      </Button>
    </div>
  );
}

// ── Add form (English base) ─────────────────────────────────────────────────────

type AddSectionValues = SectionContentValues;

function AddSectionForm({
  basePath,
  entityId,
  nextOrder,
}: {
  basePath: string;
  entityId: string;
  nextOrder: number;
}) {
  const { mutate: create, isPending } = useCreatePageContentSection(basePath, entityId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddSectionValues>({
    resolver: zodResolver(sectionContentSchema),
    defaultValues: { heading: '', body: '' },
  });

  function onSubmit(values: AddSectionValues) {
    create(
      { heading: values.heading, body: values.body, displayOrder: nextOrder },
      {
        onSuccess: () => {
          toast.success('Section added. Expand it to add translations.');
          reset({ heading: '', body: '' });
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to add section.'),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-4 border-t">
      <p className="text-xs font-semibold text-muted-foreground">Add section (English)</p>
      <Field>
        <Label>Heading</Label>
        <Input
          {...register('heading')}
          placeholder="e.g. Top things to do"
          aria-invalid={!!errors.heading}
        />
        <FieldError>{errors.heading?.message}</FieldError>
      </Field>
      <Field>
        <Label>Body</Label>
        <Textarea
          {...register('body')}
          placeholder="Write the English copy. Add other languages afterwards."
          rows={3}
          aria-invalid={!!errors.body}
        />
        <FieldError>{errors.body?.message}</FieldError>
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          <HugeiconsIcon icon={PlusSignIcon} />
          {isPending ? 'Adding...' : 'Add section'}
        </Button>
      </div>
    </form>
  );
}

// ── Manager ─────────────────────────────────────────────────────────────────────

interface ContentSectionManagerProps {
  /** Module segment, e.g. `/destinations`. */
  basePath: string;
  /** Owning entity id. */
  entityId: string;
}

export function ContentSectionManager({ basePath, entityId }: ContentSectionManagerProps) {
  const { data: groups, isLoading, isError, error } = usePageContentSections(
    basePath,
    entityId,
  );
  const list = groups ?? [];
  const nextOrder = list.length;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-none" />
          ))}
        </div>
      ) : isError ? (
        /* A failed load must NOT look like an empty list. `data` is undefined
           on error, so the old `groups ?? []` rendered "No sections yet" over a
           500 - which reads as "this island has none", the opposite of the
           truth, and invites an admin to re-type copy that already exists. */
        <div className="flex flex-col items-center gap-2 rounded-md border border-danger-fg/20 bg-danger-subtle/40 py-12 text-center">
          <HugeiconsIcon icon={Alert02Icon} className="size-8 text-danger-fg" />
          <p className="text-sm font-medium text-danger-fg">
            Could not load the sections.
          </p>
          <p className="max-w-md text-xs text-content-muted">
            {error instanceof Error ? error.message : 'The server did not respond.'}
          </p>
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <HugeiconsIcon icon={LayoutTable01Icon} className="size-10 opacity-40" />
          <p className="text-sm">No sections yet.</p>
          <p className="text-xs">
            The public page falls back to its built-in labels until you add one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((group) => (
            <SectionGroupCard
              key={group.sectionGroupId}
              basePath={basePath}
              entityId={entityId}
              group={group}
            />
          ))}
        </div>
      )}

      {!isError && (
        <AddSectionForm
          basePath={basePath}
          entityId={entityId}
          nextOrder={nextOrder}
        />
      )}
    </div>
  );
}
