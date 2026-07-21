'use client';

import { EnglishContentEditor } from '@/components/common/english-content-editor';
import { EntityTabs } from '@/components/common/entity-tabs';
import { HomepageSeoTab } from '@/components/common/entity-seo-tab';
import { HomepageExperiencesTab } from '@/components/homepage/homepage-experiences-tab';
import { HomepageFaqTab } from '@/components/homepage/homepage-faq-tab';
import { HomepageForm } from '@/components/homepage/homepage-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useHomePage } from '@/hooks/home-page/use-home-page';
import { HOME_ID } from '@/lib/api/home-page';

/**
 * The homepage editor.
 *
 * Structured exactly like every entity editor in the app - Details, Page
 * Content, SEO, FAQs - because an admin who has edited a destination has
 * already learnt this page. What is where follows the same rule as there:
 * the RECORD's own fields (images, the CTA target) are Details, everything
 * per-locale is Page Content, the search listing is SEO, questions are FAQs.
 * Experiences is the one addition: curation, which no other entity has.
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
            // The section-per-tab layout this replaced. Old links and anyone's
            // bookmarks land on the tab that now owns those fields.
            aliases={{
                hero: 'details',
                cta: 'details',
                translations: 'page-content',
            }}
            tabs={[
                {
                    value: 'details',
                    label: 'Details',
                    content: <HomepageForm content={content} />,
                },
                {
                    value: 'page-content',
                    label: 'Page Content',
                    content: (
                        <EnglishContentEditor type='homepage' id={HOME_ID} />
                    ),
                },
                {
                    value: 'experiences',
                    label: 'Experiences',
                    content: <HomepageExperiencesTab />,
                },
                {
                    value: 'seo',
                    label: 'SEO',
                    content: <HomepageSeoTab content={content} />,
                },
                {
                    value: 'faqs',
                    label: 'FAQs',
                    content: <HomepageFaqTab />,
                },
            ]}
        />
    );
}
