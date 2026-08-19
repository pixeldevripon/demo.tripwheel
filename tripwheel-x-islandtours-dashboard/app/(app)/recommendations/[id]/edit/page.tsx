import { RecommendationEditView } from '@/components/recommendations/recommendation-edit-view';

export default async function EditRecommendationPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const { tab } = await searchParams;
    return <RecommendationEditView initialTab={tab} />;
}
