import { redirect } from 'next/navigation';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function RecommendationDetailRedirect({
    params,
}: PageProps) {
    const { id } = await params;
    redirect(`/recommendations/${id}/edit`);
}
