import { CustomersListView } from '@/components/customers/customers-list-view';

export default function CustomersPage() {
    return (
        <div>
            <div className='mb-6'>
                <h1 className='font-heading text-2xl font-semibold'>Customers</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    Everyone who has booked, and who still owes a review. Operators
                    see only their own customers.
                </p>
            </div>
            <CustomersListView />
        </div>
    );
}
