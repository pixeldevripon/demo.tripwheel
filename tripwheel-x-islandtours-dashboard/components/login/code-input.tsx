'use client';

import { REGEXP_ONLY_DIGITS } from 'input-otp';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from '@/components/ui/input-otp';

/**
 * Operator 2FA numeric code entry, built on the shadcn `InputOTP` component
 * (`input-otp`): 6 digit slots as 3 + separator + 3. Slots are restyled with
 * `--it-*` tokens (it-primary active ring) to match the login card.
 * `autocomplete="one-time-code"` is set by `input-otp`, so OTP autofill + paste
 * work. Backup codes are NOT entered here - they use a plain string field
 * (a backup code is a variable-length string, not a fixed digit grid).
 */
const slotClass =
    'size-10 text-[16px] font-semibold text-it-ink border-it-border data-[active=true]:border-it-primary data-[active=true]:ring-it-primary/30';

export function OtpField({
    value,
    onChange,
}: {
    value: string;
    onChange: (next: string) => void;
}) {
    return (
        <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={value}
            onChange={onChange}
            containerClassName='justify-center'
            aria-label='Verification code'>
            <InputOTPGroup>
                <InputOTPSlot index={0} className={slotClass} />
                <InputOTPSlot index={1} className={slotClass} />
                <InputOTPSlot index={2} className={slotClass} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
                <InputOTPSlot index={3} className={slotClass} />
                <InputOTPSlot index={4} className={slotClass} />
                <InputOTPSlot index={5} className={slotClass} />
            </InputOTPGroup>
        </InputOTP>
    );
}
