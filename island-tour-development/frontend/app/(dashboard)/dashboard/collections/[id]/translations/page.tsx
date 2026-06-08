import { CollectionTranslationsView } from '@/components/dashboard/collections/collection-translations-view';

interface CollectionTranslationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionTranslationsPage({
  params,
}: CollectionTranslationsPageProps) {
  const { id } = await params;
  return <CollectionTranslationsView id={id} />;
}
