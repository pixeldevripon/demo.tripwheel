import { PaymentsListView } from '@/components/dashboard/payments/payments-list-view';

export default function PaymentsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
            Payments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platform charges per booking (deposits, full payments, refunds) with
            their provider status. Operators see payments on their own tours only.
          </p>
        </div>
      </div>
      <PaymentsListView />
    </div>
  );
}
