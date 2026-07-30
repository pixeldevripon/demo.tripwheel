import { redirect } from 'next/navigation';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function HotelDetailRedirect({ params }: PageProps) {
    const { id } = await params;
    redirect(`/hotels/${id}/edit`);
}
