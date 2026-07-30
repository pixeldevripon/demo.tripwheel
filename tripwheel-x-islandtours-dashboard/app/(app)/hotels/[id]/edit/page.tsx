import { HotelEditView } from '@/components/hotels/hotel-edit-view';

export default async function EditHotelPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const { tab } = await searchParams;
    return <HotelEditView initialTab={tab} />;
}
