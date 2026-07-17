import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/categories/${id}/edit`);
}
