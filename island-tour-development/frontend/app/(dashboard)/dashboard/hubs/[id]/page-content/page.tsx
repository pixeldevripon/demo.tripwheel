import { HubPageContentView } from '@/components/dashboard/hubs/hub-page-content-view';

interface HubPageContentPageProps {
  params: Promise<{ id: string }>;
}

export default async function HubPageContentPage({ params }: HubPageContentPageProps) {
  const { id } = await params;
  return <HubPageContentView id={id} />;
}
