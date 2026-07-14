import { ToursHeader } from '@/components/frontend/tours/tours-header';
import { getDestinationTours } from '@/lib/api/public';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * Header of the All Tours page (title + subtitle + live count). The route resolves
 * the island name + dictionary and passes them in; this reads the destination-wide
 * LIVE total cheaply (`limit: 1`, row data discarded) from a `'use cache'` loader.
 * The All Tours route is prerendered, so the header bakes into the static shell
 * (instant, kept fresh via the `tours` cache tag) rather than streaming.
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
