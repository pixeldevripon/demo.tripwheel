import { DestinationFaqsView } from '@/components/dashboard/destinations/destination-faqs-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DestinationFaqsPage({ params }: Props) {
  const { id } = await params;
  return <DestinationFaqsView id={id} />;
}
