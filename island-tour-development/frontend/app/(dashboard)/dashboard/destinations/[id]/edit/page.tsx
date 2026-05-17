import { DestinationEditView } from '@/components/dashboard/destinations/destination-edit-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditDestinationPage({ params }: Props) {
  const { id } = await params;
  return <DestinationEditView id={id} />;
}
