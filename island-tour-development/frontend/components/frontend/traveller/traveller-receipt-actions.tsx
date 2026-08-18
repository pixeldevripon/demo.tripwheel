'use client';

import { Printer } from 'lucide-react';

/**
 * The receipt's print CTA. `window.print()` is the whole feature: every
 * browser's print dialog offers "Save as PDF", so the platform ships no PDF
 * pipeline for v1 (review 9a kept invoices out until a template is specced;
 * this receipt is the deliberate middle ground).
 */
export function TravellerReceiptPrintButton({ label }: { label: string }) {
    return (
        <button
            type='button'
            onClick={() => window.print()}
            className='inline-flex cursor-pointer items-center gap-2 rounded-full bg-it-primary px-5 py-2.5 text-[14px] font-medium text-it-primary-fg transition-[filter] hover:brightness-95 tracking-[-0.012em]'>
            <Printer className='size-4' strokeWidth={2} />
            {label}
        </button>
    );
}
