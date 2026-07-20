import { ListPageSkeleton } from '@/components/skeletons/list-page-skeleton';

/**
 * Without a `loading.tsx` the App Router has no Suspense boundary for this
 * segment, so a sidebar click cannot commit until the whole RSC payload has
 * arrived - the previous page just sits there looking frozen. This file is the
 * boundary: the navigation commits instantly and the skeleton shows while the
 * segment resolves.
 *
 * The admin/operator table is the wide one (11 columns); a customer lands on
 * the same route with a narrower table, but this is a sub-second placeholder,
 * not a layout contract.
 */
export default function BookingsLoading() {
    return (
        <ListPageSkeleton
            title='Bookings'
            description='Every reservation with guest, payment and commission context. Operators see bookings on their own tours only.'
            columns={11}
            filters={4}
        />
    );
}
