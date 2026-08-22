import { RecommendationsListView } from '@/components/recommendations/recommendations-list-view';

/**
 * Island Tours' post-booking recommendations. A list that feeds a FEW cards: the
 * thank-you page and the confirmation email each promote the winning picks, so
 * the list view says which one leads each surface rather than leaving an admin to
 * work it out from the rows.
 */
export default function RecommendationsPage() {
    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>Recommendations</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    Our picks for travellers after they book - our own tours and
                    destinations, or external places to stay, eat and shop.
                    Promoted on the thank-you page and the confirmation email.
                </p>
            </div>
            <RecommendationsListView />
        </div>
    );
}
