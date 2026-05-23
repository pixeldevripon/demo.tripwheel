import { CategoryTranslationsView } from '@/components/dashboard/categories/category-translations-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CategoryTranslationsPage({ params }: Props) {
  const { id } = await params;
  return <CategoryTranslationsView id={id} />;
}
