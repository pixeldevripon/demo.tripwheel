'use client';

import { EntityTabs } from '@/components/common/entity-tabs';
import { HomepageEditorialTab } from '@/components/homepage/homepage-editorial-tab';
import { HomepageExperiencesTab } from '@/components/homepage/homepage-experiences-tab';
import { HomepageFaqTab } from '@/components/homepage/homepage-faq-tab';
import { HomepageHeroTab } from '@/components/homepage/homepage-hero-tab';
import { HomepageSeoTab } from '@/components/homepage/homepage-seo-tab';
import { Skeleton } from '@/components/ui/skeleton';
import { useHomePage } from '@/hooks/home-page/use-home-page';

/**
 * The homepage editor.
 *
 * Tabs follow the ORDER OF THE PAGE ITSELF (hero, then experiences, then the
 * CTA card, then FAQ), so scanning the tab row is scanning the homepage
 * top-to-bottom. Sharing sits last, as on every other entity editor.
 *
 * Deliberately not a page builder: sections cannot be added, removed or
 * reordered here, because their layouts are fixed in the public site's code.
 * An admin edits what is IN a section, never whether it exists.
 */
export function HomepageEditView({ initialTab }: { initialTab?: string }) {
  const { data: content, isLoading } = useHomePage();

  if (isLoading || !content) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-10 w-80' />
        <Skeleton className='h-96 w-full' />
      </div>
    );
  }

  return (
    <EntityTabs
      basePath='/homepage'
      initialTab={initialTab}
      tabs={[
        {
          value: 'hero',
          label: 'Hero',
          content: <HomepageHeroTab content={content} />,
        },
        {
          value: 'experiences',
          label: 'Experiences',
          content: <HomepageExperiencesTab content={content} />,
        },
        {
          value: 'cta',
          label: 'CTA Card',
          content: <HomepageEditorialTab content={content} />,
        },
        {
          value: 'faqs',
          label: 'FAQs',
          content: <HomepageFaqTab content={content} />,
        },
        {
          value: 'seo',
          label: 'SEO',
          content: <HomepageSeoTab content={content} />,
        },
      ]}
    />
  );
}
