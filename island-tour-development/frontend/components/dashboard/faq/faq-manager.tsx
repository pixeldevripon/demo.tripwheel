'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HelpCircleIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
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
  useCreateFaqGroup,
  useDeleteFaqGroup,
  useFaqGroups,
  useUpdateFaqGroup,
  useUpsertFaqTranslation,
} from '@/hooks/faq/use-faq-groups';
import { ALL_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';
import type { FaqGroup } from '@/types/faq';

// Backend enforces question >= 5 and answer >= 10 characters.
const faqContentSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters'),
  answer: z.string().min(10, 'Answer must be at least 10 characters'),
});
type FaqContentValues = z.infer<typeof faqContentSchema>;

// ── Per-locale editor (English base + each translation) ─────────────────────────

interface FaqLocaleEditorProps {
  basePath: string;
  entityId: string;
  groupId: string;
  locale: Locale;
  isBase?: boolean;
  existing?: { question: string; answer: string };
}

function FaqLocaleEditor({
  basePath,
  entityId,
  groupId,
  locale,
  isBase,
  existing,
}: FaqLocaleEditorProps) {
  const { mutate: upsert, isPending } = useUpsertFaqTranslation(basePath, entityId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FaqContentValues>({
    resolver: zodResolver(faqContentSchema),
    defaultValues: { question: existing?.question ?? '', answer: existing?.answer ?? '' },
  });

  useEffect(() => {
    reset({ question: existing?.question ?? '', answer: existing?.answer ?? '' });
  }, [existing?.question, existing?.answer, reset]);

  function onSubmit(values: FaqContentValues) {
    upsert(
      { groupId, locale, payload: { question: values.question, answer: values.answer } },
      {
        onSuccess: () => toast.success(`${LOCALE_LABELS[locale]} saved.`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to save.'),
      }
    );
  }

  const translated = !!existing?.question?.trim();

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
        <Label className="text-xs font-semibold uppercase">Question</Label>
        <Input {...register('question')} aria-invalid={!!errors.question} />
        <FieldError>{errors.question?.message}</FieldError>
      </Field>
      <Field>
        <Label className="text-xs font-semibold uppercase">Answer</Label>
        <Textarea {...register('answer')} rows={3} aria-invalid={!!errors.answer} />
        <FieldError>{errors.answer?.message}</FieldError>
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="xs" disabled={isPending}>
          <CheckIcon />
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

// ── FAQ card (one logical FAQ = one group) ──────────────────────────────────────

interface FaqGroupCardProps {
  basePath: string;
  entityId: string;
  group: FaqGroup;
}

function FaqGroupCard({ basePath, entityId, group }: FaqGroupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutate: updateGroup, isPending: isUpdating } = useUpdateFaqGroup(basePath, entityId);
  const { mutate: deleteGroup, isPending: isDeleting } = useDeleteFaqGroup(basePath, entityId);

  const byLocale = new Map(group.translations.map((t) => [t.locale, t]));
  const en = byLocale.get('en' as Locale);
  const translatedCount = group.translations.filter((t) => t.question?.trim()).length;

  function toggleActive(next: boolean) {
    updateGroup(
      { groupId: group.faqGroupId, payload: { isActive: next } },
      {
        onSuccess: () => toast.success(next ? 'FAQ activated.' : 'FAQ hidden.'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to update.'),
      }
    );
  }

  function handleDelete() {
    deleteGroup(group.faqGroupId, {
      onSuccess: () => {
        toast.success('FAQ deleted.');
        setDeleteOpen(false);
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'Failed to delete.'),
    });
  }

  return (
    <>
      <Card size="sm">
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm leading-snug">
                {en?.question ?? '(no English question)'}
              </p>
              {en?.answer && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{en.answer}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">#{group.displayOrder}</span>
                <Badge variant={group.isActive ? 'default' : 'secondary'}>
                  {group.isActive ? 'Active' : 'Hidden'}
                </Badge>
                <Badge variant="outline">
                  {translatedCount}/{ALL_LOCALES.length} languages
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 px-2 h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={expanded ? 'Hide editor' : 'Edit & translate'}
              >
                {expanded ? (
                  <ChevronUpIcon className="size-3.5" />
                ) : (
                  <ChevronDownIcon className="size-3.5" />
                )}
                <span className="hidden sm:inline">Edit &amp; translate</span>
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>

          {expanded && (
            <div className="mt-5 pt-5 border-t space-y-6">
              {/* Group settings */}
              <div className="flex flex-wrap items-end gap-4">
                <DisplayOrderField
                  current={group.displayOrder}
                  disabled={isUpdating}
                  onSave={(displayOrder) =>
                    updateGroup(
                      { groupId: group.faqGroupId, payload: { displayOrder } },
                      {
                        onSuccess: () => toast.success('Order updated.'),
                        onError: (err) =>
                          toast.error(err instanceof Error ? err.message : 'Failed to update.'),
                      }
                    )
                  }
                />
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    id={`faq-active-${group.faqGroupId}`}
                    checked={group.isActive}
                    disabled={isUpdating}
                    onCheckedChange={(checked) => toggleActive(!!checked)}
                  />
                  <Label
                    htmlFor={`faq-active-${group.faqGroupId}`}
                    className="text-xs font-semibold uppercase cursor-pointer"
                  >
                    Active
                  </Label>
                </div>
              </div>

              {/* English base + translations - same tabbed UI as the
                  Translations / Page Content tabs. */}
              <Tabs defaultValue={DEFAULT_LOCALE}>
                <div className="pb-2 mb-4">
                  <TabsList>
                    {ALL_LOCALES.map((locale) => (
                      <TabsTrigger key={locale} value={locale} className="px-2.5 sm:px-4">
                        <span className="sm:hidden uppercase">{locale}</span>
                        <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {ALL_LOCALES.map((locale) => {
                  const t = byLocale.get(locale);
                  return (
                    <TabsContent key={locale} value={locale}>
                      <FaqLocaleEditor
                        basePath={basePath}
                        entityId={entityId}
                        groupId={group.faqGroupId}
                        locale={locale}
                        isBase={locale === DEFAULT_LOCALE}
                        existing={t ? { question: t.question, answer: t.answer } : undefined}
                      />
                    </TabsContent>
                  );
                })}
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon className="size-8 text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete FAQ</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the FAQ and all of its translations. This action cannot be undone.
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
        <Label className="text-xs font-semibold uppercase">Display Order</Label>
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
        size="xs"
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

function AddFaqForm({
  basePath,
  entityId,
  nextOrder,
}: {
  basePath: string;
  entityId: string;
  nextOrder: number;
}) {
  const { mutate: create, isPending } = useCreateFaqGroup(basePath, entityId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FaqContentValues>({
    resolver: zodResolver(faqContentSchema),
    defaultValues: { question: '', answer: '' },
  });

  function onSubmit(values: FaqContentValues) {
    create(
      { question: values.question, answer: values.answer, displayOrder: nextOrder },
      {
        onSuccess: () => {
          toast.success('FAQ added. Expand it to add translations.');
          reset({ question: '', answer: '' });
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to add FAQ.'),
      }
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-4 border-t">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Add FAQ (English)</p>
      <Field>
        <Label className="text-xs font-semibold uppercase">Question</Label>
        <Input
          {...register('question')}
          placeholder="e.g. What is the best time to visit?"
          aria-invalid={!!errors.question}
        />
        <FieldError>{errors.question?.message}</FieldError>
      </Field>
      <Field>
        <Label className="text-xs font-semibold uppercase">Answer</Label>
        <Textarea
          {...register('answer')}
          placeholder="Write the English answer. Add other languages afterwards."
          rows={3}
          aria-invalid={!!errors.answer}
        />
        <FieldError>{errors.answer?.message}</FieldError>
      </Field>
      <FieldDescription>
        Add the FAQ in English first, then expand it to translate into other languages.
      </FieldDescription>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          <PlusIcon />
          {isPending ? 'Adding...' : 'Add FAQ'}
        </Button>
      </div>
    </form>
  );
}

// ── Manager ─────────────────────────────────────────────────────────────────────

interface FaqManagerProps {
  /** Module segment, e.g. `/destinations`, `/categories`, `/hubs`, `/collections`. */
  basePath: string;
  /** Owning entity id. */
  entityId: string;
}

export function FaqManager({ basePath, entityId }: FaqManagerProps) {
  const { data: groups, isLoading } = useFaqGroups(basePath, entityId);
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
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <HelpCircleIcon className="size-10 opacity-40" />
          <p className="text-sm">No FAQs yet.</p>
          <p className="text-xs">Add your first FAQ in English below.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((group) => (
            <FaqGroupCard
              key={group.faqGroupId}
              basePath={basePath}
              entityId={entityId}
              group={group}
            />
          ))}
        </div>
      )}

      <AddFaqForm basePath={basePath} entityId={entityId} nextOrder={nextOrder} />
    </div>
  );
}
