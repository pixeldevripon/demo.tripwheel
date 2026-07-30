'use client';

import { useParams } from 'next/navigation';

import { EnglishContentEditor } from '@/components/common/english-content-editor';
import { EntityTabs } from '@/components/common/entity-tabs';
import { HotelForm } from '@/components/hotels/hotel-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useHotel } from '@/hooks/hotels/use-hotels';
import { hotelName } from '@/types/hotel';

/**
 * One hotel's editor.
 *
 * Two tabs, following the same split as every entity editor in the app: the
 * RECORD's own fields (photo, link, rating, price, order) are Details, everything
 * per-locale is Content. What other entities have and this does not: no SEO tab
 * (the thank-you page is `noindex` by design), no FAQs, no page content.
 */
export function HotelEditView({ initialTab }: { initialTab?: string }) {
    const params = useParams<{ id: string }>();
    const id = params.id;
    const { data: hotel, isLoading } = useHotel(id);

    if (isLoading || !hotel) {
        return (
            <div className='space-y-4'>
                <Skeleton className='h-10 w-80' />
                <Skeleton className='h-96 w-full' />
            </div>
        );
    }

    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>{hotelName(hotel)}</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    Promoted at the bottom of the thank-you page once a traveller
                    has booked a tour. The card&apos;s layout is fixed in the
                    site design - what you change here is what goes in it.
                </p>
            </div>

            <EntityTabs
                basePath={`/hotels/${id}`}
                initialTab={initialTab}
                // The per-locale tab is called `translations` on every other
                // entity; anyone who learnt that URL lands on the right tab.
                aliases={{ translations: 'content' }}
                tabs={[
                    {
                        value: 'details',
                        label: 'Details',
                        content: <HotelForm hotel={hotel} />,
                    },
                    {
                        value: 'content',
                        label: 'Content',
                        content: <EnglishContentEditor type='hotel' id={id} />,
                    },
                ]}
            />
        </div>
    );
}
