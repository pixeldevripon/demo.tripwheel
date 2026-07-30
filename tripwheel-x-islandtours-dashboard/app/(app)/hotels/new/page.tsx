import { HotelForm } from '@/components/hotels/hotel-form';

export default function NewHotelPage() {
    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>New Hotel</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    Only the name is required. A hotel with no photo or booking
                    link is created and simply is not promoted until you add
                    them.
                </p>
            </div>
            <HotelForm />
        </div>
    );
}
