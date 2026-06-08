'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  PlusIcon,
  HelpCircleIcon,
  PencilIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  useCollectionFaqs,
  useCreateCollectionFaq,
  useUpdateCollectionFaq,
  useDeleteCollectionFaq,
} from '@/hooks/collections/use-collections';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';
import type { CollectionFaq } from '@/types/collection';

const faqSchema = z.object({
  question: z.string().min(3, 'Question must be at least 3 characters'),
  answer: z.string().min(3, 'Answer must be at least 3 characters'),
  displayOrder: z.number().int().min(0).optional(),
  locale: z.enum(['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh']),
  isActive: z.boolean().optional(),
});

type FaqFormValues = z.infer<typeof faqSchema>;

interface FaqCardProps {
  faq: CollectionFaq;
  collectionId: string;
}

function FaqCard({ faq, collectionId }: FaqCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutate: updateFaq, isPending: isUpdating } = useUpdateCollectionFaq();
  const { mutate: deleteFaq, isPending: isDeleting } = useDeleteCollectionFaq();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Omit<FaqFormValues, 'locale'>>({
    resolver: zodResolver(faqSchema.omit({ locale: true })),
    defaultValues: {
      question: faq.question,
      answer: faq.answer,
      displayOrder: faq.displayOrder,
      isActive: faq.isActive,
    },
  });

  const isActiveValue = watch('isActive');

  function onSubmitEdit(values: Omit<FaqFormValues, 'locale'>) {
    updateFaq(
      {
        id: collectionId,
        faqId: faq.id,
        payload: {
          question: values.question,
          answer: values.answer,
          displayOrder: values.displayOrder,
          isActive: values.isActive,
        },
      },
      {
        onSuccess: () => {
          toast.success('FAQ updated.');
          setIsEditing(false);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to update FAQ.'),
      }
    );
  }

  function handleDelete() {
    deleteFaq(
      { id: collectionId, faqId: faq.id },
      {
        onSuccess: () => {
          toast.success('FAQ deleted.');
          setDeleteOpen(false);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to delete FAQ.'),
      }
    );
  }

  return (
    <>
      <Card size="sm">
        <CardContent className="pt-5">
          {isEditing ? (
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
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
              <div className="flex items-center gap-4">
                <Field className="flex-1">
                  <Label className="text-xs font-semibold uppercase">Display Order</Label>
                  <Input
                    type="number"
                    {...register('displayOrder', { valueAsNumber: true })}
                    className="w-24"
                  />
                </Field>
                <div className="flex items-center gap-2 mt-5">
                  <Checkbox
                    id={`isActive-${faq.id}`}
                    checked={isActiveValue}
                    onCheckedChange={(checked) => setValue('isActive', !!checked)}
                  />
                  <Label
                    htmlFor={`isActive-${faq.id}`}
                    className="text-xs font-semibold uppercase cursor-pointer"
                  >
                    Active
                  </Label>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsEditing(false)}
                  disabled={isUpdating}
                >
                  <XIcon />
                  Cancel
                </Button>
                <Button type="submit" size="xs" disabled={isUpdating}>
                  <CheckIcon />
                  {isUpdating ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-snug">{faq.question}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{faq.answer}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => setIsEditing(true)}>
                    <PencilIcon />
                  </Button>
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
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="secondary">{LOCALE_LABELS[faq.locale]}</Badge>
                <span className="text-xs text-muted-foreground">#{faq.displayOrder}</span>
                <span
                  className={`size-1.5 rounded-full ${faq.isActive ? 'bg-emerald-500' : 'bg-red-400'}`}
                />
                <Badge variant={faq.isActive ? 'default' : 'secondary'}>
                  {faq.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
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
              Are you sure you want to delete this FAQ? This action cannot be undone.
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

interface CreateFaqDialogProps {
  collectionId: string;
  onSuccess: () => void;
}

function CreateFaqDialog({ collectionId, onSuccess }: CreateFaqDialogProps) {
  const [open, setOpen] = useState(false);
  const { mutate: createFaq, isPending } = useCreateCollectionFaq();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FaqFormValues>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question: '',
      answer: '',
      displayOrder: 0,
      locale: 'en',
      isActive: true,
    },
  });

  const localeValue = watch('locale');

  function onSubmit(values: FaqFormValues) {
    createFaq(
      {
        id: collectionId,
        payload: {
          question: values.question,
          answer: values.answer,
          displayOrder: values.displayOrder,
          locale: values.locale,
        },
      },
      {
        onSuccess: () => {
          toast.success('FAQ created.');
          reset();
          setOpen(false);
          onSuccess();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to create FAQ.'),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          Add FAQ
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add FAQ</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field>
            <Label className="text-xs font-semibold uppercase">Locale</Label>
            <Select value={localeValue} onValueChange={(val) => setValue('locale', val as Locale)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_LOCALES.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    {LOCALE_LABELS[locale]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">Question</Label>
            <Input
              {...register('question')}
              placeholder="What is..."
              aria-invalid={!!errors.question}
            />
            <FieldError>{errors.question?.message}</FieldError>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">Answer</Label>
            <Textarea
              {...register('answer')}
              placeholder="The answer is..."
              rows={4}
              aria-invalid={!!errors.answer}
            />
            <FieldError>{errors.answer?.message}</FieldError>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">Display Order</Label>
            <Input
              type="number"
              {...register('displayOrder', { valueAsNumber: true })}
              className="w-32"
              placeholder="0"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create FAQ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CollectionFaqManagerProps {
  collectionId: string;
}

export function CollectionFaqManager({ collectionId }: CollectionFaqManagerProps) {
  const [localeFilter, setLocaleFilter] = useState<string>('all');
  const { data: faqs, isLoading } = useCollectionFaqs(
    collectionId,
    localeFilter !== 'all' ? (localeFilter as Locale) : undefined
  );

  const filteredFaqs = faqs ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold uppercase">Locale</Label>
          <Select value={localeFilter} onValueChange={setLocaleFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locales</SelectItem>
              {ALL_LOCALES.map((locale) => (
                <SelectItem key={locale} value={locale}>
                  {LOCALE_LABELS[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CreateFaqDialog collectionId={collectionId} onSuccess={() => {}} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-none" />
          ))}
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <HelpCircleIcon className="size-10 opacity-40" />
          <p className="text-sm">No FAQs found.</p>
          <p className="text-xs">Add your first FAQ using the button above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((faq) => (
            <FaqCard key={faq.id} faq={faq} collectionId={collectionId} />
          ))}
        </div>
      )}
    </div>
  );
}
