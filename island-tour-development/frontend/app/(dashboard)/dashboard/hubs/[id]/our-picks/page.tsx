import { HubOurPicksView } from '@/components/dashboard/hubs/hub-our-picks-view';

interface HubOurPicksPageProps {
  params: Promise<{ id: string }>;
}

export default async function HubOurPicksPage({ params }: HubOurPicksPageProps) {
  const { id } = await params;
  return <HubOurPicksView id={id} />;
}
