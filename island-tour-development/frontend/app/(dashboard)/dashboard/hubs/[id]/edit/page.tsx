import { HubEditView } from '@/components/dashboard/hubs/hub-edit-view';

interface HubEditPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function HubEditPage({ params, searchParams }: HubEditPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <HubEditView id={id} initialTab={tab} />;
}
