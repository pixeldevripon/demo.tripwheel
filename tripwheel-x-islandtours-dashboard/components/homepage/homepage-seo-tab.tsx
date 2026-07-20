'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ImageField, SettingsCard } from '@/components/settings/settings-fields';
import { useSaveHomepageSection } from '@/hooks/home-page/use-home-page';
import type { HomePageContent } from '@/types/home-page';

export function HomepageSeoTab({ content }: { content: HomePageContent }) {
  const { save, isPending } = useSaveHomepageSection();

  const { handleSubmit, reset, watch, setValue } = useForm<{ ogImage: string }>(
    { defaultValues: { ogImage: '' } },
  );

  useEffect(() => {
    reset({ ogImage: content.ogImage ?? '' });
  }, [content, reset]);

  const values = watch();

  return (
    <SettingsCard
      title='Sharing'
      description='How the homepage looks when someone posts the link. Saving publishes straight to the live site.'
      isSaving={isPending}
      saveLabel='Save and publish'
      onSubmit={handleSubmit(v => {
        void save({ base: { ogImage: v.ogImage.trim() || null } })
          .then(() => toast.success('Sharing image published.'))
          .catch(err =>
            toast.error(err instanceof Error ? err.message : 'Failed to save.'),
          );
      })}
    >
      <ImageField
        label='Share image'
        description={
          values.ogImage
            ? 'The preview thumbnail on WhatsApp, Facebook and X. 1200x630 works everywhere.'
            : 'The preview thumbnail on WhatsApp, Facebook and X. 1200x630 works everywhere. Currently falling back to the site-wide share image from Settings.'
        }
        value={values.ogImage || null}
        onChange={url => setValue('ogImage', url ?? '')}
      />
    </SettingsCard>
  );
}
