import { CategoryEditView } from '@/components/dashboard/categories/category-edit-view';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function EditCategoryPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <CategoryEditView id={id} initialTab={tab} />;
}
