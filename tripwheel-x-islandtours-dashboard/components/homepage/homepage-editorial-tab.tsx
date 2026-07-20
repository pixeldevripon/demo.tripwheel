'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ImageSelectorField } from '@/components/common/image-selector-field';
import { HomepageField } from '@/components/homepage/homepage-field';
import { HomepageSectionCard } from '@/components/homepage/homepage-section-card';
import { Field, FieldDescription } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useSaveHomepageSection } from '@/hooks/home-page/use-home-page';
import { HOMEPAGE_DEFAULTS } from '@/lib/home-page/defaults';
import type { HomePageContent } from '@/types/home-page';

interface EditorialValues {
  editorialImages: string[];
  editorialDestinationId: string;
  editorialTitleLine1: string;
  editorialTitleLine2: string;
  editorialBody: string;
  editorialCta: string;
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

/** Sentinel for the Select - Radix cannot hold an empty-string item value. */
const AUTO_DESTINATION = '__auto__';

export function HomepageEditorialTab({ content }: { content: HomePageContent }) {
  const { save, isPending } = useSaveHomepageSection();
  const { data: destinations = [] } = useActiveDestinations();
  const english = content.translations.find(t => t.locale === 'en');

  const { register, handleSubmit, reset, watch, setValue } =
    useForm<EditorialValues>({
      defaultValues: {
        editorialImages: [],
        editorialDestinationId: AUTO_DESTINATION,
        editorialTitleLine1: '',
        editorialTitleLine2: '',
        editorialBody: '',
        editorialCta: '',
      },
    });

  useEffect(() => {
    reset({
      editorialImages: content.editorialImages ?? [],
      editorialDestinationId:
        content.editorialDestinationId ?? AUTO_DESTINATION,
      editorialTitleLine1: english?.editorialTitleLine1 ?? '',
      editorialTitleLine2: english?.editorialTitleLine2 ?? '',
      editorialBody: english?.editorialBody ?? '',
      editorialCta: english?.editorialCta ?? '',
    });
  }, [content, english, reset]);

  const values = watch();

  function onSubmit(v: EditorialValues) {
    void save({
      base: {
        editorialImages: v.editorialImages,
        editorialDestinationId:
          v.editorialDestinationId === AUTO_DESTINATION
            ? null
            : v.editorialDestinationId,
      },
      fields: {
        editorialTitleLine1: orNull(v.editorialTitleLine1),
        editorialTitleLine2: orNull(v.editorialTitleLine2),
        editorialBody: orNull(v.editorialBody),
        editorialCta: orNull(v.editorialCta),
      },
    })
      .then(() => toast.success('CTA card published.'))
      .catch(err =>
        toast.error(
          err instanceof Error ? err.message : 'Failed to save the CTA card.',
        ),
      );
  }

  return (
    <HomepageSectionCard
      title='CTA card'
      description='The orange banner near the bottom of the homepage, with the fanned photo deck and a button.'
      translatable
      isPending={isPending}
      onSave={handleSubmit(onSubmit)}>
      <Field>
        <Label>Fanned photos</Label>
        <ImageSelectorField
          multiple
          maxFiles={3}
          value={values.editorialImages}
          onChange={urls => setValue('editorialImages', urls)}
        />
        <FieldDescription>
          The three angled cards beside the copy, in fan order (left, middle,
          front). Portrait crops work best.
          {values.editorialImages.length < 3 ? (
            <>
              {' '}
              <span className='text-content-muted'>
                The deck always shows three cards - any you leave empty keep
                their built-in photo.
              </span>
            </>
          ) : null}
        </FieldDescription>
      </Field>

      <Field>
        <Label>Button links to</Label>
        <Select
          value={values.editorialDestinationId}
          onValueChange={v => setValue('editorialDestinationId', v)}>
          <SelectTrigger>
            <SelectValue placeholder='Choose automatically' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO_DESTINATION}>
              Choose automatically
            </SelectItem>
            {destinations.map(d => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          Which island the button opens. Left automatic, the site picks the
          launch island, then the first active one. An island you archive later
          falls back the same way rather than linking somewhere broken.
        </FieldDescription>
      </Field>

      <HomepageField
        label='Headline, first line'
        where='The top line of the two-line heading on the card.'
        value={values.editorialTitleLine1}
        fallback={HOMEPAGE_DEFAULTS.editorialTitleLine1}
        maxLength={60}
        register={register('editorialTitleLine1')}
      />

      <HomepageField
        label='Headline, second line'
        where='The bottom line of the heading, directly beneath the first.'
        value={values.editorialTitleLine2}
        fallback={HOMEPAGE_DEFAULTS.editorialTitleLine2}
        maxLength={60}
        register={register('editorialTitleLine2')}
      />

      <HomepageField
        label='Body'
        where='The paragraph under the heading.'
        value={values.editorialBody}
        fallback={HOMEPAGE_DEFAULTS.editorialBody}
        multiline
        rows={3}
        maxLength={280}
        register={register('editorialBody')}
      />

      <HomepageField
        label='Button label'
        where='The text inside the white button.'
        value={values.editorialCta}
        fallback={HOMEPAGE_DEFAULTS.editorialCta}
        maxLength={40}
        register={register('editorialCta')}
      />
    </HomepageSectionCard>
  );
}
