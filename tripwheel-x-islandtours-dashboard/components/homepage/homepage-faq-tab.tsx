'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FaqManager } from '@/components/common/faq-manager';
import { TranslationPointer } from '@/components/homepage/translation-pointer';
import {
  SettingsCard,
  TextField,
  TextareaField,
} from '@/components/settings/settings-fields';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSaveHomepageSection } from '@/hooks/home-page/use-home-page';
import { HOME_ID } from '@/lib/api/home-page';
import { describeField, HOMEPAGE_DEFAULTS } from '@/lib/home-page/defaults';
import type { HomePageContent } from '@/types/home-page';

interface FaqCopyValues {
  faqTitle: string;
  faqSubtitle: string;
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

/**
 * The FAQ block: its heading copy, then the questions.
 *
 * The questions are the shared FaqManager, unmodified - the homepage is just
 * another (pageType, entityId) pair to the backend, with the singleton key as
 * its id, so grouping, ordering, activation and per-locale translation all
 * behave exactly as they do on a destination or category.
 */
export function HomepageFaqTab({ content }: { content: HomePageContent }) {
  const { save, isPending } = useSaveHomepageSection();
  const english = content.translations.find(t => t.locale === 'en');

  const { register, handleSubmit, reset, watch } = useForm<FaqCopyValues>({
    defaultValues: { faqTitle: '', faqSubtitle: '' },
  });

  useEffect(() => {
    reset({
      faqTitle: english?.faqTitle ?? '',
      faqSubtitle: english?.faqSubtitle ?? '',
    });
  }, [english, reset]);

  const values = watch();

  function onSubmit(v: FaqCopyValues) {
    void save({
      fields: {
        faqTitle: orNull(v.faqTitle),
        faqSubtitle: orNull(v.faqSubtitle),
      },
    })
      .then(() => toast.success('FAQ heading published.'))
      .catch(err =>
        toast.error(
          err instanceof Error ? err.message : 'Failed to save the heading.',
        ),
      );
  }

  return (
    <div className='space-y-6'>
      <SettingsCard
        title='FAQ heading'
        description='The title and intro beside the questions. Saving publishes straight to the live site.'
        isSaving={isPending}
        saveLabel='Save and publish'
        onSubmit={handleSubmit(onSubmit)}
      >
        <TextField
          label='Title'
          registration={register('faqTitle')}
          placeholder={HOMEPAGE_DEFAULTS.faqTitle}
          description={describeField(
            'The heading above the FAQ list.',
            values.faqTitle,
            HOMEPAGE_DEFAULTS.faqTitle,
          )}
        />

        <TextareaField
          label='Intro'
          registration={register('faqSubtitle')}
          placeholder={HOMEPAGE_DEFAULTS.faqSubtitle}
          description={describeField(
            'The paragraph under the title, beside the WhatsApp button.',
            values.faqSubtitle,
            HOMEPAGE_DEFAULTS.faqSubtitle,
          )}
        />

        <TranslationPointer />
      </SettingsCard>

      <Card>
        <CardHeader className='border-b pb-6'>
          <CardTitle>Questions</CardTitle>
          <p className='mt-1 text-sm font-normal normal-case tracking-normal text-muted-foreground'>
            The expandable list on the homepage. Add nothing and the site keeps
            its built-in questions; add one and your list replaces them
            entirely.
          </p>
        </CardHeader>
        <CardContent className='pt-8'>
          <FaqManager basePath='/home-page' entityId={HOME_ID} />
        </CardContent>
      </Card>
    </div>
  );
}
