import { OperatorEditView } from '@/components/dashboard/operators/operator-edit-view';

interface TourOperatorEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function TourOperatorEditPage({ params }: TourOperatorEditPageProps) {
  const { id } = await params;
  return <OperatorEditView id={id} />;
}
