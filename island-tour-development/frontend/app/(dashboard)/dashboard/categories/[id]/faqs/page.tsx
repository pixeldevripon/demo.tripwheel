import { CategoryFaqsView } from '@/components/dashboard/categories/category-faqs-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CategoryFaqsPage({ params }: Props) {
  const { id } = await params;
  return <CategoryFaqsView id={id} />;
}
