import { HubAllowedCategoriesView } from '@/components/dashboard/hubs/hub-allowed-categories-view';

interface HubAllowedCategoriesPageProps {
  params: Promise<{ id: string }>;
}

export default async function HubAllowedCategoriesPage({ params }: HubAllowedCategoriesPageProps) {
  const { id } = await params;
  return <HubAllowedCategoriesView id={id} />;
}
