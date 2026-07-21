import {
    NotFoundScreen,
    type NotFoundIsland,
} from '@/components/frontend/status/not-found-screen';
import { getActiveDestinations } from '@/lib/api/public';

/**
 * The public 404. Renders for every `notFound()` under `/{locale}` - an unknown
 * destination, category, hub, collection or tour slug - and inside the locale
 * layout, so the navbar and footer stay put and the traveler is never dropped
 * onto a bare page.
 *
 * `not-found.tsx` receives no `params`, so the language is resolved from the
 * pathname inside <NotFoundScreen> (a client leaf). The island rail is fetched
 * here in the default locale: destination names are proper nouns and read the
 * same in all seven, and `getActiveDestinations` returns `[]` when the backend
 * is unreachable - so a 404 during an outage silently drops the rail instead of
 * failing into the error boundary.
 */
export default async function LocaleNotFound() {
    const destinations = await getActiveDestinations();

    const islands: NotFoundIsland[] = destinations
        .slice(0, 6)
        .map(({ name, slug }) => ({ name, slug }));

    return <NotFoundScreen islands={islands} />;
}
