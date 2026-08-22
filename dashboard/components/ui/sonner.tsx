'use client';

import {
    Alert02Icon,
    Cancel01Icon,
    CancelCircleIcon,
    CheckmarkCircle02Icon,
    InformationCircleIcon,
    Loading03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * 16px at stroke 2 - the weight is what makes it readable, not the size.
 *
 * It was 20px, sized to a 14px title. The title is 13px now, and 20px next to
 * it read as a badge with a sentence attached. At stroke 2 a 16px glyph is
 * still unmistakable at a glance, which was the original point; the default
 * hairline at 16px is what looked like a scratch, not the size.
 *
 * Severity colour is RICH (2026-08-16, user call): the whole toast carries the
 * type's subtle wash, border and text ramp, and the glyph renders bare in the
 * solid accent colour - see `.cn-toast` in globals.css. Sonner's own `richColors`
 * prop stays OFF on purpose: it paints sonner's baked palette, which ignores
 * the app's design tokens and fights the `.cn-toast` rules for specificity.
 */
const ICON_CLASS = 'size-4';

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = 'system' } = useTheme();

    return (
        <Sonner
            theme={theme as ToasterProps['theme']}
            // Alignment CSS in `.cn-toast` follows this prop via
            // data-x-position, so any of the six values Just Works. Width hugs
            // content (350px floor) inside a viewport-wide lane.
            position='bottom-right'
            offset={12}
            gap={8}
            // Every toast is explicitly dismissable. The disc is restyled in
            // `.cn-toast [data-close-button]` - pinned right-centre instead of
            // sonner's floating top-left corner.
            closeButton
            // No `text-sm!` here: it forced 14px onto the whole toast and beat
            // the per-element sizes in `.cn-toast [data-title] / [data-description]`,
            // so the type scale could only ever be set from one of the two
            // places. globals.css owns it.
            className='toaster group'
            icons={{
                success: (
                    <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        strokeWidth={2}
                        className={ICON_CLASS}
                    />
                ),
                info: (
                    <HugeiconsIcon
                        icon={InformationCircleIcon}
                        strokeWidth={2}
                        className={ICON_CLASS}
                    />
                ),
                warning: (
                    <HugeiconsIcon
                        icon={Alert02Icon}
                        strokeWidth={2}
                        className={ICON_CLASS}
                    />
                ),
                error: (
                    <HugeiconsIcon
                        icon={CancelCircleIcon}
                        strokeWidth={2}
                        className={ICON_CLASS}
                    />
                ),
                loading: (
                    <HugeiconsIcon
                        icon={Loading03Icon}
                        strokeWidth={2}
                        className={`${ICON_CLASS} animate-spin`}
                    />
                ),
                close: (
                    <HugeiconsIcon
                        icon={Cancel01Icon}
                        strokeWidth={2}
                        className='size-3.5'
                    />
                ),
            }}
            toastOptions={{ classNames: { toast: 'cn-toast' } }}
            {...props}
        />
    );
};

export { Toaster };
