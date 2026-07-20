'use client';

import type { Locale } from '@/lib/constants/locales';
import type { TranslatableEntityType } from '@/lib/translatable-schema';
import {
    CategoryWorkspace,
    CollectionWorkspace,
    DestinationWorkspace,
    HomepageWorkspace,
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
    }
}
