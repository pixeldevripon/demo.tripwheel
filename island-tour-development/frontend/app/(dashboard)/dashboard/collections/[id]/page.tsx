import { redirect } from 'next/navigation';

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { id } = await params;
  redirect(`/dashboard/collections/${id}/edit`);
}
