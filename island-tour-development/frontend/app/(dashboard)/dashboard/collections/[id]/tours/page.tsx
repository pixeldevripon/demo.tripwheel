import { CollectionToursView } from '@/components/dashboard/collections/collection-tours-view';

interface CollectionToursPageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionToursPage({ params }: CollectionToursPageProps) {
  const { id } = await params;
  return <CollectionToursView id={id} />;
}
