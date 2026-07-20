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
  DEFAULT_HERO_IMAGE_LABEL,
  HOMEPAGE_DEFAULTS,
} from '@/lib/home-page/defaults';
import { useSaveHomepageSection } from '@/hooks/home-page/use-home-page';
import type { HomePageContent } from '@/types/home-page';

interface HeroValues {
  heroImage: string;
  heroTitle: string;
  heroSubtitle: string;
}

/** Blank string clears the field back to its built-in default. */
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
    <HomepageSectionCard
      title='Hero'
      description='The full-width photo and headline at the very top of the homepage.'
      translatable
      isPending={isPending}
      onSave={handleSubmit(onSubmit)}>
      <Field>
        <Label>Background photo</Label>
        <ImageSelectorField
          value={values.heroImage || null}
          onChange={url => setValue('heroImage', url ?? '')}
        />
        <FieldDescription>
          Fills the top of the homepage behind the headline. Landscape, at least
          1920px wide.
          {!values.heroImage ? (
            <>
              {' '}
              <span className='text-content-muted'>
                Currently showing the built-in default:{' '}
                {DEFAULT_HERO_IMAGE_LABEL}.
              </span>
            </>
          ) : null}
        </FieldDescription>
      </Field>

      <HomepageField
        label='Headline'
        where='The large text over the hero photo.'
        value={values.heroTitle}
        fallback={HOMEPAGE_DEFAULTS.heroTitle}
        maxLength={120}
        register={register('heroTitle')}
      />

      <HomepageField
        label='Subheading'
        where='The smaller line directly under the headline.'
        value={values.heroSubtitle}
        fallback={HOMEPAGE_DEFAULTS.heroSubtitle}
        maxLength={160}
        register={register('heroSubtitle')}
      />
    </HomepageSectionCard>
  );
}
