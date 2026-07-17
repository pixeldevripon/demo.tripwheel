import { AttributeEditView } from '@/components/dashboard/attributes/attribute-edit-view';

interface Props {
  params: Promise<{ key: string }>;
}

export default async function EditAttributePage({ params }: Props) {
  const { key } = await params;
  return <AttributeEditView attributeKey={key} />;
}
