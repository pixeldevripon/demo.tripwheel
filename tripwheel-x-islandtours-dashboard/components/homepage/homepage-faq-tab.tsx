'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FaqManager } from '@/components/common/faq-manager';
import { HomepageField } from '@/components/homepage/homepage-field';
import { HomepageSectionCard } from '@/components/homepage/homepage-section-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSaveHomepageSection } from '@/hooks/home-page/use-home-page';
import { HOME_ID } from '@/lib/api/home-page';
import { HOMEPAGE_DEFAULTS } from '@/lib/home-page/defaults';
import type { HomePageContent } from '@/types/home-page';

interface FaqCopyValues {
  faqTitle: string;
  faqSubtitle: string;
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

/**
 * The FAQ block: its heading copy, then the questions themselves.
 *
 * The questions reuse the shared FaqManager unmodified - the homepage is just
 * another (pageType, entityId) pair to the backend, with the singleton key as
 * its id.
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
      <HomepageSectionCard
        title='FAQ heading'
        description='The title and intro line beside the questions.'
        translatable
        isPending={isPending}
        onSave={handleSubmit(onSubmit)}>
        <HomepageField
          label='Title'
          where='The heading above the FAQ list.'
          value={values.faqTitle}
          fallback={HOMEPAGE_DEFAULTS.faqTitle}
          maxLength={120}
          register={register('faqTitle')}
        />

        <HomepageField
          label='Intro'
          where='The paragraph under the FAQ title, beside the WhatsApp button.'
          value={values.faqSubtitle}
          fallback={HOMEPAGE_DEFAULTS.faqSubtitle}
          multiline
          rows={3}
          maxLength={400}
          register={register('faqSubtitle')}
        />
      </HomepageSectionCard>

      <Card>
        <CardHeader className='border-b pb-8'>
          <CardTitle>Questions</CardTitle>
          <p className='m-0 mt-2 text-sm text-content-muted'>
            Shown as the expandable list on the homepage. Add nothing here and
            the site keeps its built-in questions; add one and your list
            replaces them entirely.
          </p>
        </CardHeader>
        <CardContent className='pt-8'>
          <FaqManager basePath='/home-page' entityId={HOME_ID} />
        </CardContent>
      </Card>
    </div>
  );
}
