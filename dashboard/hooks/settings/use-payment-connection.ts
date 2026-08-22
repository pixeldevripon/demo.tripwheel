import { settingsApi } from '@/lib/api/settings';
import { PAYMENT_BRANDS } from '@/lib/settings/payment-method-guides';
import { PROVIDER_LABELS } from '@/lib/settings/payment-requirements';
import type {
  PaymentConnectionStatus,
  PaymentMethodBrand,
  PaymentProvider,
} from '@/types/settings';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsKeys } from './use-settings';

/**
 * The payments board's live data: does each stored PSP credential actually
 * WORK, and which traveller-facing methods are activated on each account.
 * Separate file from use-settings.ts only because this shipped while another
 * change was in flight there - it belongs to the same family and borrows its
 * key factory.
 */
export const paymentConnectionKey = () =>
  [...settingsKeys.all, 'payment-connection'] as const;

/**
 * One probe when the Payments tab first mounts, then cache. Every probe makes
 * live calls to both PSPs, so window refocus must not re-fire it - manual
 * re-checks go through `useTestPaymentConnection`.
 */
export function usePaymentConnectionStatus() {
  return useQuery({
    queryKey: paymentConnectionKey(),
    queryFn: () => settingsApi.getPaymentConnectionStatus(),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}

export interface TestConnectionVariables {
  provider: PaymentProvider;
  /**
   * When set, the toast answers for this ONE method ("Card via Stripe:
   * active") instead of the provider as a whole. The probe itself is always
   * the full provider snapshot - a method cannot be checked in isolation,
   * and the fresh column updates every row of that provider's group anyway.
   */
  brand?: PaymentMethodBrand;
  /** Toast wording for the brand (a method row spanning several brands says "Card", not "Visa"). */
  label?: string;
}

/**
 * The "Test connection" / per-method "Test" buttons: re-probe ONE provider
 * live and fold its fresh column into the cached board (the response's other
 * column is null by design - it must never wipe cached data). Outcome lands
 * as a toast AND in the strip/row badges, because a toast alone evaporates
 * before the admin finishes reading the error.
 */
export function useTestPaymentConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider }: TestConnectionVariables) =>
      settingsApi.getPaymentConnectionStatus(provider),
    onSuccess: (result, { provider, brand, label: labelOverride }) => {
      qc.setQueryData<PaymentConnectionStatus>(paymentConnectionKey(), prev => ({
        ...(prev ?? result),
        activeProvider: result.activeProvider,
        checkedAt: result.checkedAt,
        ...(result.stripe ? { stripe: result.stripe } : {}),
        ...(result.mollie ? { mollie: result.mollie } : {}),
      }));

      const column = provider === 'STRIPE' ? result.stripe : result.mollie;
      const label = PROVIDER_LABELS[provider];
      if (!column) return;

      if (!column.configured) {
        toast.warning(
          `${label} is not configured yet - add the ${column.missing.join(', ')} first.`,
        );
        return;
      }

      if (brand) {
        const brandLabel =
          labelOverride ??
          PAYMENT_BRANDS.find(b => b.key === brand)?.label ??
          brand;
        if (!column.ok) {
          toast.error(
            `Could not verify ${brandLabel} - the ${label} connection failed: ${column.error ?? 'unknown error'}`,
          );
          return;
        }
        const status =
          column.methods.find(m => m.key === brand)?.status ?? 'inactive';
        if (status === 'active') {
          toast.success(
            `${brandLabel} via ${label}: configured${column.mode ? ` (${column.mode} mode)` : ''}`,
          );
        } else if (status === 'unsupported') {
          toast.info(`${label} does not offer ${brandLabel} at all.`);
        } else {
          toast.warning(
            `${brandLabel} is not configured on the ${label} account - open "How to activate" for the steps.`,
          );
        }
        return;
      }

      if (column.ok) {
        toast.success(
          `${label} connection OK${column.mode ? ` (${column.mode} mode)` : ''}${
            column.accountLabel ? ` - ${column.accountLabel}` : ''
          }`,
        );
      } else {
        toast.error(
          `${label} connection failed: ${column.error ?? 'unknown error'}`,
        );
      }
    },
    // The probe route is rate limited (12/min) because it calls the PSPs
    // live; the raw ThrottlerException is not fit to show.
    onError: (err: Error) =>
      toast.error(
        /throttler|too many requests/i.test(err.message)
          ? 'Too many connection tests in a row - wait a minute and try again.'
          : err.message || 'Connection test failed',
      ),
  });
}
