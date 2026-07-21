'use client';

import { FaqManager } from '@/components/common/faq-manager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HOME_ID } from '@/lib/api/home-page';

/**
 * The homepage FAQ list, in the same shell every other entity's FAQ tab uses.
 *
 * The questions are the shared FaqManager, unmodified - the homepage is just
 * another (pageType, entityId) pair to the backend, with the singleton key as
 * its id, so grouping, ordering, activation and per-locale translation all
 * behave exactly as they do on a destination or category.
 *
 * The block's TITLE and INTRO are per-locale copy, so they live with the rest
 * of the page's words in Page Content rather than being a second form here.
 */
export function HomepageFaqTab() {
    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='text-lg font-semibold'>FAQs</CardTitle>
            </CardHeader>
            <CardContent className='pt-6'>
                <p className='mb-6 rounded-md bg-surface-sunken px-3 py-2 text-xs text-content-muted'>
                    The expandable list on the homepage. Add nothing and the
                    site keeps its built-in questions; add one and your list
                    replaces them entirely. The heading above this list is
                    edited in Page Content.
                </p>
                <FaqManager basePath='/home-page' entityId={HOME_ID} />
            </CardContent>
        </Card>
    );
}
