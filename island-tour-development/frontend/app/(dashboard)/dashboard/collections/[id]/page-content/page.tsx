import { CollectionPageContentView } from '@/components/dashboard/collections/collection-page-content-view';

interface CollectionPageContentPageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionPageContentPage({
  params,
}: CollectionPageContentPageProps) {
  const { id } = await params;
  return <CollectionPageContentView id={id} />;
}
