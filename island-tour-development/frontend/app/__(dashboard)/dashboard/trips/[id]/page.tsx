import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/trips/${id}/edit`);
}
