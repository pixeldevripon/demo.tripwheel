import { CollectionEditView } from '@/components/dashboard/collections/collection-edit-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCollectionPage({ params }: Props) {
  const { id } = await params;
  return <CollectionEditView id={id} />;
}
