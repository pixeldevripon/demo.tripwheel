import { HubComparisonView } from '@/components/dashboard/hubs/hub-comparison-view';

interface HubComparisonPageProps {
  params: Promise<{ id: string }>;
}

export default async function HubComparisonPage({ params }: HubComparisonPageProps) {
  const { id } = await params;
  return <HubComparisonView id={id} />;
}
