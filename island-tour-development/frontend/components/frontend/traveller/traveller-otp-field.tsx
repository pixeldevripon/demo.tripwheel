'use client';

import { OTPInput } from 'input-otp';

/**
 * Six-digit code entry, sized to the card rather than to fixed slot widths.
 *
 * The shadcn `InputOTP` preset draws small joined boxes with a separator - fine
 * inside a dense dashboard form, but it leaves a wide gap on either side of a
 * login card and reads as an afterthought. Here each box is `flex-1`, so the
 * row always spans the full card width at any breakpoint, and the boxes grow
 * with it. Rendered through `input-otp`'s own `render` prop so the styling is
 * ours outright instead of a pile of overrides fighting the preset.
 */
export function TravellerOtpField({
    id,
    value,
    onChange,
    disabled,
    autoFocus,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    autoFocus?: boolean;
}) {
    return (
        <OTPInput
            id={id}
            maxLength={6}
            value={value}
            onChange={onChange}
            disabled={disabled}
            autoFocus={autoFocus}
            inputMode='numeric'
            pattern='[0-9]*'
            autoComplete='one-time-code'
            containerClassName='flex w-full px-5 items-center gap-2 sm:gap-2.5 has-disabled:opacity-60'
            className='disabled:cursor-not-allowed'
            render={({ slots }) => (
                <>
                    {slots.map((slot, i) => (
                        <div
                            key={i}
                            className={`relative flex h-12 flex-1 items-center justify-center rounded-[12px] border bg-it-white text-[22px] leading-none font-normal tracking-[-0.012em] text-it-heading transition-colors  sm:text-[24px] ${
                                slot.isActive
                                    ? 'border-it-primary ring-2 ring-it-primary/15'
                                    : slot.char
                                      ? 'border-it-heading/25'
                                      : 'border-it-border'
                            }`}>
                            {slot.char}
                            {slot.hasFakeCaret && (
                                <span className='pointer-events-none absolute inset-0 flex items-center justify-center'>
                                    <span className='animate-caret-blink h-5 w-px bg-it-heading' />
                                </span>
                            )}
                        </div>
                    ))}
                </>
            )}
        />
    );
}

