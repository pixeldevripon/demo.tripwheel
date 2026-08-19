import { redirect } from 'next/navigation';

interface HubPageProps {
  params: Promise<{ id: string }>;
}

export default async function HubPage({ params }: HubPageProps) {
  const { id } = await params;
  redirect(`/hubs/${id}/edit`);
}
