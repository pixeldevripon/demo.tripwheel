import { HotelsListView } from '@/components/hotels/hotels-list-view';

/**
 * Island Tours' own hotels. A list, but one that feeds a SINGLE card: the
 * thank-you page promotes exactly one, so the list view says which one that is
 * rather than leaving an admin to work it out from the rows.
 */
export default function HotelsPage() {
    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>Hotels</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    Our own places to stay, promoted at the bottom of the
                    thank-you page once a traveller has booked a tour. One shows
                    at a time - the first switched-on, complete one in order.
                </p>
            </div>
            <HotelsListView />
        </div>
    );
}
