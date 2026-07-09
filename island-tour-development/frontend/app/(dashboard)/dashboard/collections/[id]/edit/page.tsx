import { CollectionEditView } from '@/components/dashboard/collections/collection-edit-view';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function EditCollectionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <CollectionEditView id={id} initialTab={tab} />;
}
