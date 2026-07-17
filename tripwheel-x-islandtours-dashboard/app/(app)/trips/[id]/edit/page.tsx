import { TripEditorView } from '@/components/trips/editor/trip-editor-view';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function EditTripPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <TripEditorView id={id} initialTab={tab} />;
}
