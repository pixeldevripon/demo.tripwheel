import { HubContentSectionsView } from '@/components/dashboard/hubs/hub-content-sections-view';

interface HubContentSectionsPageProps {
  params: Promise<{ id: string }>;
}

export default async function HubContentSectionsPage({ params }: HubContentSectionsPageProps) {
  const { id } = await params;
  return <HubContentSectionsView id={id} />;
}
