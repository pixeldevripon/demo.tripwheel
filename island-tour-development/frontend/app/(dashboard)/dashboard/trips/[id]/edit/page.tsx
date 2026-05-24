import { TripEditView } from '@/components/dashboard/trips/trip-edit-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTripPage({ params }: Props) {
  const { id } = await params;
  return <TripEditView id={id} />;
}
