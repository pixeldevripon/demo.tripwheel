'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { TranslationPointer } from '@/components/homepage/translation-pointer';
import {
  ImageField,
  SettingsCard,
  TextField,
  TextareaField,
} from '@/components/settings/settings-fields';
import { useSaveHomepageSection } from '@/hooks/home-page/use-home-page';
import {
  DEFAULT_HERO_IMAGE_LABEL,
  describeField,
  HOMEPAGE_DEFAULTS,
} from '@/lib/home-page/defaults';
import type { HomePageContent } from '@/types/home-page';

interface HeroValues {
  heroImage: string;
  heroTitle: string;
  heroSubtitle: string;
}

/** Blank clears the field back to the copy the site ships with. */
const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function HomepageHeroTab({ content }: { content: HomePageContent }) {
  const { save, isPending } = useSaveHomepageSection();
  const english = content.translations.find(t => t.locale === 'en');

  const { register, handleSubmit, reset, watch, setValue } =
    useForm<HeroValues>({
      defaultValues: { heroImage: '', heroTitle: '', heroSubtitle: '' },
    });

  useEffect(() => {
    reset({
      heroImage: content.heroImage ?? '',
      heroTitle: english?.heroTitle ?? '',
      heroSubtitle: english?.heroSubtitle ?? '',
    });
  }, [content, english, reset]);

  const values = watch();

  function onSubmit(v: HeroValues) {
    void save({
      base: { heroImage: orNull(v.heroImage) },
      fields: {
        heroTitle: orNull(v.heroTitle),
        heroSubtitle: orNull(v.heroSubtitle),
      },
    })
      .then(() => toast.success('Hero published.'))
      .catch(err =>
        toast.error(
          err instanceof Error ? err.message : 'Failed to save the hero.',
        ),
      );
  }

  return (
    <SettingsCard
      title='Hero'
      description='The full-width photo and headline at the very top of the homepage. Saving publishes straight to the live site.'
      isSaving={isPending}
      saveLabel='Save and publish'
      onSubmit={handleSubmit(onSubmit)}
    >
      <ImageField
        label='Background photo'
        description={
          values.heroImage
            ? 'Fills the top of the homepage behind the headline. Landscape, at least 1920px wide.'
            : `Fills the top of the homepage behind the headline. Landscape, at least 1920px wide. Currently showing the built-in default: ${DEFAULT_HERO_IMAGE_LABEL}.`
        }
        value={values.heroImage || null}
        onChange={url => setValue('heroImage', url ?? '')}
      />

      <TextField
        label='Headline'
        registration={register('heroTitle')}
        placeholder={HOMEPAGE_DEFAULTS.heroTitle}
        description={describeField(
          'The large text over the hero photo.',
          values.heroTitle,
          HOMEPAGE_DEFAULTS.heroTitle,
        )}
      />

      <TextareaField
        label='Subheading'
        registration={register('heroSubtitle')}
        placeholder={HOMEPAGE_DEFAULTS.heroSubtitle}
        description={describeField(
          'The smaller line directly under the headline.',
          values.heroSubtitle,
          HOMEPAGE_DEFAULTS.heroSubtitle,
        )}
      />

      <TranslationPointer />
    </SettingsCard>
  );
}
