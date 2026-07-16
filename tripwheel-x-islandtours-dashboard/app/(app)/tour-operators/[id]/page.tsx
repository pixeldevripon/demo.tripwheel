import { redirect } from 'next/navigation';

interface TourOperatorPageProps {
  params: Promise<{ id: string }>;
}

export default async function TourOperatorPage({ params }: TourOperatorPageProps) {
  const { id } = await params;
  redirect(`/tour-operators/${id}/edit`);
}
