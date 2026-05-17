import { DestinationPageContentView } from '@/components/dashboard/destinations/destination-page-content-view';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function DestinationPageContentPage({ params }: Props) {
    const { id } = await params;
    return <DestinationPageContentView id={id} />;
}

