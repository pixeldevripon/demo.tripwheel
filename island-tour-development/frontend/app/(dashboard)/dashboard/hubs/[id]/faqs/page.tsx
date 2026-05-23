import { HubFaqsView } from '@/components/dashboard/hubs/hub-faqs-view';

interface HubFaqsPageProps {
  params: Promise<{ id: string }>;
}

export default async function HubFaqsPage({ params }: HubFaqsPageProps) {
  const { id } = await params;
  return <HubFaqsView id={id} />;
}
