'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MultiSelect } from '@/components/ui/multi-select';
import { STRIPE_PAYMENT_METHODS } from './payment-methods';

/** Per-method setup guidance shown before a method is enabled. */
const METHOD_GUIDE: Record<string, { title: string; steps: string[] }> = {
  card: {
    title: 'Enable Card payments',
    steps: [
      'Cards are on by default once your Stripe account is active.',
      'Collected inline at checkout (no redirect); supports every currency.',
    ],
  },
  ideal: {
    title: 'Enable iDEAL',
    steps: [
      'In Stripe → Settings → Payment methods, turn on iDEAL for your account.',
      'iDEAL is EUR-only, so it appears at checkout only for EUR bookings.',
      'The shopper is redirected to their bank to authorise, then returned.',
    ],
  },
  paypal: {
    title: 'Enable PayPal',
    steps: [
      'In Stripe → Settings → Payment methods, turn on PayPal and finish the PayPal connection.',
      'The shopper is redirected to PayPal to authorise, then returned.',
      'Until it is active on your Stripe account it stays hidden at checkout.',
    ],
  },
};

/**
 * Stripe payment-methods multiselect with guardrails: enabling a method opens a
 * short setup guide (confirm), and disabling one asks for confirmation (travelers
 * lose that option at checkout). Only supported methods are selectable
 * (`STRIPE_PAYMENT_METHODS`). Controlled - defers the actual change until confirmed.
 */
export function StripeMethodsField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [pending, setPending] = useState<{
    next: string[];
    kind: 'add' | 'remove';
    method: string;
  } | null>(null);

  const label = (v: string) =>
    STRIPE_PAYMENT_METHODS.find((o) => o.value === v)?.label ?? v;

  function handleChange(next: string[]) {
    const added = next.filter((v) => !value.includes(v));
    const removed = value.filter((v) => !next.includes(v));
    if (removed.length > 0) {
      setPending({ next, kind: 'remove', method: removed[0] });
    } else if (added.length > 0) {
      setPending({ next, kind: 'add', method: added[0] });
    } else {
      onChange(next);
    }
  }

  function confirm() {
    if (pending) onChange(pending.next);
    setPending(null);
  }

  const guide = pending?.method ? METHOD_GUIDE[pending.method] : undefined;

  return (
    <>
      <MultiSelect
        options={STRIPE_PAYMENT_METHODS}
        value={value}
        onChange={handleChange}
        placeholder="Select payment methods"
      />

      {/* Disable a method - confirm (travelers lose it at checkout). */}
      <AlertDialog
        open={pending?.kind === 'remove'}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {pending ? label(pending.method) : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Travelers will no longer be able to pay with{' '}
              {pending ? label(pending.method) : 'this method'} at checkout. You
              can re-enable it anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enable a method - setup guide (confirm). */}
      <Dialog
        open={pending?.kind === 'add'}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{guide?.title ?? 'Enable payment method'}</DialogTitle>
            <DialogDescription>
              Set this up in Stripe first, then it appears at checkout when
              eligible for the booking&apos;s currency.
            </DialogDescription>
          </DialogHeader>
          {guide && (
            <ol className="list-decimal space-y-2 pl-6 text-sm text-muted-foreground">
              {guide.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={confirm}>Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
