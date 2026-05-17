import { DestinationTranslationsView } from '@/components/dashboard/destinations/destination-translations-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DestinationTranslationsPage({ params }: Props) {
  const { id } = await params;
  return <DestinationTranslationsView id={id} />;
}
