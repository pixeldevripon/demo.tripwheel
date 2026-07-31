import { RecommendationForm } from '@/components/recommendations/recommendation-form';

export default function NewRecommendationPage() {
    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>New Recommendation</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    Point at one of our own entities, or add an external pick. An
                    external one only needs a name to start - the rest is filled
                    in afterwards.
                </p>
            </div>
            <RecommendationForm />
        </div>
    );
}
