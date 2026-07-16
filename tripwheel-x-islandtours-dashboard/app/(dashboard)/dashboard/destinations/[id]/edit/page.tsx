import { DestinationEditView } from '@/components/destinations/destination-edit-view';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function EditDestinationPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <DestinationEditView id={id} initialTab={tab} />;
}
