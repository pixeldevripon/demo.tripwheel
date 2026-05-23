import { HubEditView } from '@/components/dashboard/hubs/hub-edit-view';

interface HubEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function HubEditPage({ params }: HubEditPageProps) {
  const { id } = await params;
  return <HubEditView id={id} />;
}
