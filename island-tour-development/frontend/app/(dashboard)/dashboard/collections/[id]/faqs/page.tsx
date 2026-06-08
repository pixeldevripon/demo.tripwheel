import { CollectionFaqsView } from '@/components/dashboard/collections/collection-faqs-view';

interface CollectionFaqsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionFaqsPage({ params }: CollectionFaqsPageProps) {
  const { id } = await params;
  return <CollectionFaqsView id={id} />;
}
