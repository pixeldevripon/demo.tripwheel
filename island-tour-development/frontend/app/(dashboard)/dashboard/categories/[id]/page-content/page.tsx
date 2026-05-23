import { CategoryPageContentView } from '@/components/dashboard/categories/category-page-content-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CategoryPageContentPage({ params }: Props) {
  const { id } = await params;
  return <CategoryPageContentView id={id} />;
}
