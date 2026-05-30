import { TripEditView } from '@/components/dashboard/trips/trip-edit-view';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function EditTripPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <TripEditView id={id} initialTab={tab} />;
}
