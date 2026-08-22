import { PageEditView } from '@/components/pages/page-edit-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPagePage({ params }: Props) {
  const { id } = await params;
  return <PageEditView pageId={id} />;
}
