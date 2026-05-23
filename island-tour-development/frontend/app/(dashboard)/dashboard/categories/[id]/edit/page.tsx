import { CategoryEditView } from '@/components/dashboard/categories/category-edit-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;
  return <CategoryEditView id={id} />;
}
