import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PageDetailRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/pages/${id}/edit`);
}
