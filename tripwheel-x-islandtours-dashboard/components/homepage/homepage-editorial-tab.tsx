'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ImageSelectorField } from '@/components/common/image-selector-field';
import { TranslationPointer } from '@/components/homepage/translation-pointer';
import {
  SettingsCard,
  TextField,
  TextareaField,
} from '@/components/settings/settings-fields';
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
import { describeField, HOMEPAGE_DEFAULTS } from '@/lib/home-page/defaults';
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

/** Radix cannot hold an empty-string item value, so "automatic" needs a token. */
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
    <SettingsCard
      title='CTA card'
      description='The banner near the bottom of the homepage, with the fanned photo deck and a button. Saving publishes straight to the live site.'
      isSaving={isPending}
      saveLabel='Save and publish'
      onSubmit={handleSubmit(onSubmit)}
    >
      {/* Multi-image, so the shared single-image ImageField does not fit. */}
      <Field>
        <Label>Fanned photos</Label>
        <FieldDescription>
          The three angled cards beside the copy, in fan order (left, middle,
          front). Portrait crops work best.
          {values.editorialImages.length < 3
            ? ' The deck always shows three cards - any you leave empty keep their built-in photo.'
            : ''}
        </FieldDescription>
        <ImageSelectorField
          multiple
          maxFiles={3}
          value={values.editorialImages}
          onChange={urls => setValue('editorialImages', urls)}
        />
      </Field>

      <Field>
        <Label>Button links to</Label>
        <FieldDescription>
          Which island the button opens. Left automatic, the site picks the
          launch island, then the first active one. An island you archive later
          falls back the same way rather than linking somewhere broken.
        </FieldDescription>
        <Select
          value={values.editorialDestinationId}
          onValueChange={v => setValue('editorialDestinationId', v)}
        >
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
      </Field>

      <div className='grid gap-6 sm:grid-cols-2'>
        <TextField
          label='Headline, first line'
          registration={register('editorialTitleLine1')}
          placeholder={HOMEPAGE_DEFAULTS.editorialTitleLine1}
          description={describeField(
            'Top line of the two-line heading.',
            values.editorialTitleLine1,
            HOMEPAGE_DEFAULTS.editorialTitleLine1,
          )}
        />
        <TextField
          label='Headline, second line'
          registration={register('editorialTitleLine2')}
          placeholder={HOMEPAGE_DEFAULTS.editorialTitleLine2}
          description={describeField(
            'Bottom line, directly beneath the first.',
            values.editorialTitleLine2,
            HOMEPAGE_DEFAULTS.editorialTitleLine2,
          )}
        />
      </div>

      <TextareaField
        label='Body'
        registration={register('editorialBody')}
        placeholder={HOMEPAGE_DEFAULTS.editorialBody}
        description={describeField(
          'The paragraph under the heading.',
          values.editorialBody,
          HOMEPAGE_DEFAULTS.editorialBody,
        )}
      />

      <TextField
        label='Button label'
        registration={register('editorialCta')}
        placeholder={HOMEPAGE_DEFAULTS.editorialCta}
        description={describeField(
          'The text inside the button.',
          values.editorialCta,
          HOMEPAGE_DEFAULTS.editorialCta,
        )}
      />

      <TranslationPointer />
    </SettingsCard>
  );
}
