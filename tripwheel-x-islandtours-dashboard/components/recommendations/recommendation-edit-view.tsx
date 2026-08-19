'use client';

import { useParams } from 'next/navigation';

import { EnglishContentEditor } from '@/components/common/english-content-editor';
import { EntityTabs } from '@/components/common/entity-tabs';
import { RecommendationForm } from '@/components/recommendations/recommendation-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecommendation } from '@/hooks/recommendations/use-recommendations';
import { recommendationName } from '@/types/recommendation';

/**
 * One recommendation's editor.
 *
 * The Details tab holds the RECORD's own fields (source, category, placements,
 * and either the internal reference or the external photo/link/price). The
 * Content tab holds the per-locale copy - but ONLY for EXTERNAL recommendations:
 * an INTERNAL one draws its words from the entity it points at, so it has no copy
 * of its own to translate, and the tab is dropped.
 *
 * What other entity editors have and this does not: no SEO tab (the surfaces are
 * `noindex` by design), no FAQs, no page content.
 */
export function RecommendationEditView({
    initialTab,
}: {
    initialTab?: string;
}) {
    const params = useParams<{ id: string }>();
    const id = params.id;
    const { data: recommendation, isLoading } = useRecommendation(id);

    if (isLoading || !recommendation) {
        return (
            <div className='space-y-4'>
                <Skeleton className='h-10 w-80' />
                <Skeleton className='h-96 w-full' />
            </div>
        );
    }

    const isExternal = recommendation.source === 'EXTERNAL';

    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>
                    {recommendationName(recommendation)}
                </h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    Promoted on the post-booking surfaces once a traveller has
                    booked a tour. The card&apos;s layout is fixed in the site
                    design - what you change here is what goes in it.
                </p>
            </div>

            <EntityTabs
                basePath={`/recommendations/${id}`}
                initialTab={initialTab}
                aliases={{ translations: 'content' }}
                tabs={[
                    {
                        value: 'details',
                        label: 'Details',
                        content: (
                            <RecommendationForm
                                recommendation={recommendation}
                            />
                        ),
                    },
                    // INTERNAL recommendations have no copy of their own, so the
                    // Content tab would be a form that writes nothing the card
                    // reads. It appears only for EXTERNAL picks.
                    ...(isExternal
                        ? [
                              {
                                  value: 'content',
                                  label: 'Content',
                                  content: (
                                      <EnglishContentEditor
                                          type='recommendation'
                                          id={id}
                                      />
                                  ),
                              },
                          ]
                        : []),
                ]}
            />
        </div>
    );
}
