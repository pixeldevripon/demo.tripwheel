import { connection } from 'next/server';

import { ToursHeader } from '@/components/frontend/tours-header';
import { getDestinationTours } from '@/lib/api/public';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * Async, streamed header of the All Tours page (title + subtitle + live count).
 * The route resolves the island name + dictionary and passes them in; this reads
 * the destination-wide LIVE total cheaply (`limit: 1`, row data discarded) and is
 * marked dynamic with `await connection()` so its `<Suspense>` skeleton actually
 * streams under Cache Components (the loader itself stays cached, so it is fast).
 */

interface HeaderSectionProps {
    destinationId: string;
    destinationName: string;
    dict: Dictionary;
}

export async function ToursHeaderSection({
    destinationId,
    destinationName,
    dict,
}: HeaderSectionProps) {
    await connection();
    const { total } = await getDestinationTours({ destinationId, limit: 1 });

    return (
        <ToursHeader
            dict={dict.destination.allTours.heading}
            destinationName={destinationName}
            total={total}
            selectDateLabel={dict.destination.allTours.toolbar.selectDate}
        />
    );
}
