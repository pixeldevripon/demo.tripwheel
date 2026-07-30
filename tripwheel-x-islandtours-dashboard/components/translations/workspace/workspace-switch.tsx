'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useRole } from '@/contexts/role-context';
import type { Locale } from '@/lib/constants/locales';
import {
    TRANSLATABLE_ENTITY_PERMISSIONS,
    type TranslatableEntityType,
} from '@/lib/translatable-schema';
import {
    CategoryWorkspace,
    CollectionWorkspace,
    DestinationWorkspace,
    HomepageWorkspace,
    HotelWorkspace,
    HubWorkspace,
} from './entity-workspaces';
import { TourWorkspace } from './tour-workspace';

export function TranslationWorkspaceSwitch({
    type,
    id,
    locale,
}: {
    type: TranslatableEntityType;
    id: string;
    locale: Locale;
}) {
    // Hiding the matrix tab only removes the link; this URL is still typeable and
    // still bookmarked from before a role change. Gate the workspace itself on
    // the same permission so it cannot be reached sideways. (The backend guards
    // every save regardless - this is so the page says so instead of letting
    // someone type a translation that 403s on submit.)
    const { canAny } = useRole();
    if (!canAny(TRANSLATABLE_ENTITY_PERMISSIONS[type])) {
        return (
            <div className='flex flex-col items-center gap-3 py-16 text-center'>
                <p className='text-sm text-content-muted'>
                    You do not have permission to translate this content.
                </p>
                <Button asChild size='sm' variant='outline'>
                    <Link href='/translations'>Back to Translations</Link>
                </Button>
            </div>
        );
    }

    switch (type) {
        case 'tour':
            return <TourWorkspace id={id} locale={locale} />;
        case 'destination':
            return <DestinationWorkspace id={id} locale={locale} />;
        case 'category':
            return <CategoryWorkspace id={id} locale={locale} />;
        case 'hub':
            return <HubWorkspace id={id} locale={locale} />;
        case 'collection':
            return <CollectionWorkspace id={id} locale={locale} />;
        // Singleton - the id segment is always 'default' and carries no meaning.
        case 'homepage':
            return <HomepageWorkspace locale={locale} />;
        case 'hotel':
            return <HotelWorkspace id={id} locale={locale} />;
    }
}
