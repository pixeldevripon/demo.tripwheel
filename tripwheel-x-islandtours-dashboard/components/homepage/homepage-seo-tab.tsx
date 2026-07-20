'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ImageSelectorField } from '@/components/common/image-selector-field';
import { HomepageSectionCard } from '@/components/homepage/homepage-section-card';
import { Field, FieldDescription } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { useSaveHomepageSection } from '@/hooks/home-page/use-home-page';
import type { HomePageContent } from '@/types/home-page';

export function HomepageSeoTab({ content }: { content: HomePageContent }) {
  const { save, isPending } = useSaveHomepageSection();

  const { handleSubmit, reset, watch, setValue } = useForm<{
    ogImage: string;
  }>({ defaultValues: { ogImage: '' } });

  useEffect(() => {
    reset({ ogImage: content.ogImage ?? '' });
  }, [content, reset]);

  const values = watch();

  return (
    <HomepageSectionCard
      title='Sharing'
      description='How the homepage looks when someone posts the link.'
      isPending={isPending}
      onSave={handleSubmit(v => {
        void save({ base: { ogImage: v.ogImage.trim() || null } })
          .then(() => toast.success('Sharing image published.'))
          .catch(err =>
            toast.error(err instanceof Error ? err.message : 'Failed to save.'),
          );
      })}>
      <Field>
        <Label>Share image</Label>
        <ImageSelectorField
          value={values.ogImage || null}
          onChange={url => setValue('ogImage', url ?? '')}
        />
        <FieldDescription>
          The preview thumbnail on WhatsApp, Facebook and X. 1200x630 works
          everywhere.
          {!values.ogImage ? (
            <>
              {' '}
              <span className='text-content-muted'>
                Currently falling back to the site-wide share image from
                Settings.
              </span>
            </>
          ) : null}
        </FieldDescription>
      </Field>
    </HomepageSectionCard>
  );
}
