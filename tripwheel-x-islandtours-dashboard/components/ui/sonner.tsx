'use client';

import {
    Alert02Icon,
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
 * These carry the ONLY semantic colour on a toast (`.cn-toast [data-icon]` in
 * globals.css). `richColors` is deliberately NOT enabled: it tints the entire
 * toast, turning any multi-line message into a block of solid colour, and it
 * draws its own coloured left border on top of the surface.
 */
const ICON_CLASS = 'size-4';

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = 'system' } = useTheme();

    return (
        <Sonner
            theme={theme as ToasterProps['theme']}
            // The status ribbon anchors here (2026-07-30, user call; see
            // `.cn-toast` in globals.css - alignment CSS follows this prop via
            // data-x-position, so any of the six values Just Works). Prefer a
            // TOP position: every long dashboard form has a sticky Save bar at
            // the bottom and a toast must never sit on it. Width hugs content
            // (350px floor) inside a viewport-wide lane.
            position='top-right'
            offset={12}
            gap={8}
            closeButton
            // No `text-sm!` here: it forced 14px onto the whole toast and beat
            // the per-element sizes in `.cn-toast [data-title] / [data-description]`,
            // so the type scale could only ever be set from one of the two
            // places. globals.css owns it.
            className='toaster group [--normal-bg:var(--popover)] [--normal-text:var(--popover-foreground)]'
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
            }}
            toastOptions={{ classNames: { toast: 'cn-toast' } }}
            {...props}
        />
    );
};

export { Toaster };

