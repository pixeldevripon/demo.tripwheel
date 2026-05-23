import { HubTranslationsView } from '@/components/dashboard/hubs/hub-translations-view';

interface HubTranslationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function HubTranslationsPage({ params }: HubTranslationsPageProps) {
  const { id } = await params;
  return <HubTranslationsView id={id} />;
}
