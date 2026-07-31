import Link from 'next/link';

import { RecommendationCategoriesView } from '@/components/recommendations/recommendation-categories-view';

export default function RecommendationCategoriesPage() {
    return (
        <div>
            <div className='mb-6'>
                <Link
                    href='/recommendations'
                    className='text-sm text-muted-foreground hover:underline underline-offset-4'>
                    &larr; Back to Recommendations
                </Link>
                <h1 className='mt-2 text-2xl font-medium'>
                    Recommendation Categories
                </h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    The buckets recommendations are grouped under on the page.
                    Seeded categories are protected from deletion.
                </p>
            </div>
            <RecommendationCategoriesView />
        </div>
    );
}
