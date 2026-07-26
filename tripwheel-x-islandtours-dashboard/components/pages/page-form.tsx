'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  ImageField,
  SettingsCard,
  TextField,
  TextareaField,
} from '@/components/settings/settings-fields';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import {
  useCreatePage,
  useUpdatePage,
  useUpsertPageTranslation,
} from '@/hooks/pages/use-pages';
import { toSlug } from '@/lib/utils';
import type { PageDetail } from '@/types/pages';
import { RichTextEditor } from './rich-text-editor';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().optional(),
  body: z.string(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Create/edit form for a Page. English-only by design: the legal source text
 * is English and served with a notice on every other locale (per-locale rows
 * exist in the schema for a future translation pass).
 *
 * Saving in edit mode is TWO sequential writes (base fields, then English
 * content) - both target the same page, and a half-applied pair is easier to
 * reason about than two racing requests.
 */
export function PageForm({ page }: { page?: PageDetail }) {
  const router = useRouter();
  const isEdit = !!page;
  const english = page?.translations.find((t) => t.locale === 'en');

  const { mutateAsync: createPage, isPending: creating } = useCreatePage();
  const { mutateAsync: updatePage, isPending: updating } = useUpdatePage();
  const { mutateAsync: upsertTranslation, isPending: translating } =
    useUpsertPageTranslation();

  // Once the admin touches the slug, stop deriving it from the title.
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: english?.title ?? '',
      slug: page?.slug ?? '',
      body: english?.body ?? '',
      metaTitle: english?.metaTitle ?? '',
      metaDescription: english?.metaDescription ?? '',
      ogImage: page?.ogImage ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (!isEdit) {
        const created = await createPage({
          title: values.title,
          slug: values.slug || undefined,
          body: values.body || undefined,
          metaTitle: values.metaTitle || null,
          metaDescription: values.metaDescription || null,
          ogImage: values.ogImage || null,
        });
        toast.success('Page created as a draft');
        router.push(`/pages/${created.id}/edit`);
        return;
      }

      await updatePage({
        id: page.id,
        payload: {
          slug: values.slug || undefined,
          ogImage: values.ogImage || null,
        },
      });
      await upsertTranslation({
        id: page.id,
        locale: 'en',
        payload: {
          fields: {
            title: values.title,
            body: values.body,
            metaTitle: values.metaTitle || null,
            metaDescription: values.metaDescription || null,
          },
        },
      });
      toast.success(
        page.status === 'PUBLISHED'
          ? 'Saved - changes are live'
          : 'Saved',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  });

  return (
    <SettingsCard
      title={isEdit ? 'Page Content' : 'New Page'}
      description={
        isEdit
          ? page.status === 'PUBLISHED'
            ? 'Saving publishes straight to the live page.'
            : 'This page is a draft - it is not publicly visible until published.'
          : 'Pages are created as drafts; publish from the Pages list when ready.'
      }
      onSubmit={onSubmit}
      isSaving={creating || updating || translating}
      saveLabel={isEdit ? 'Save Changes' : 'Create Page'}
    >
      <TextField
        label="Title"
        registration={register('title', {
          onChange: (e) => {
            if (!slugTouched) {
              setValue('slug', toSlug((e.target as HTMLInputElement).value));
            }
          },
        })}
        error={errors.title?.message}
        placeholder="Terms of Service"
      />

      <TextField
        label="Permalink"
        description={
          isEdit
            ? 'The page URL: /{locale}/{permalink}. Nesting is allowed (e.g. legal/terms). Renaming a published page automatically redirects (301) the old URL to the new one.'
            : 'The page URL: /{locale}/{permalink}. Nesting is allowed (e.g. legal/terms). Generated from the title until you edit it.'
        }
        registration={register('slug', {
          onChange: () => setSlugTouched(true),
        })}
        error={errors.slug?.message}
        placeholder="terms-of-service"
      />
      {isEdit && page.redirectFromSlugs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Old permalinks redirecting here:{' '}
          {page.redirectFromSlugs.map((s) => `/${s}`).join(', ')}
        </p>
      )}

      <Field>
        <Label>Body</Label>
        <Controller
          control={control}
          name="body"
          render={({ field }) => (
            <RichTextEditor value={field.value} onChange={field.onChange} />
          )}
        />
        <FieldDescription>
          The editor shows exactly how the page renders on the live site. Links
          must be https:// or mailto:.
        </FieldDescription>
        {errors.body?.message && <FieldError>{errors.body.message}</FieldError>}
      </Field>

      <TextField
        label="Meta Title"
        description="Search-engine title. Empty = the page title."
        registration={register('metaTitle')}
        error={errors.metaTitle?.message}
      />
      <TextareaField
        label="Meta Description"
        registration={register('metaDescription')}
        error={errors.metaDescription?.message}
      />


      <ImageField
        label="OG Image"
        description="Social-share image for this page. Empty = the site-wide default."
        value={watch('ogImage') || null}
        onChange={(url) => setValue('ogImage', url ?? '', { shouldDirty: true })}
      />
    </SettingsCard>
  );
}
