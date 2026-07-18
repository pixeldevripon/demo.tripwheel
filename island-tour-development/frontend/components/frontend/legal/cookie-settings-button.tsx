'use client';

import { useState } from 'react';

declare global {
    interface Window {
        Cookiebot?: { renew?: () => void };
    }
}

/**
 * The "[Open your cookie settings]" block from the Manage Cookies handover
 * page. Reopens the Cookiebot preference center via Cookiebot.renew() - we
 * never hand-build toggles (README: Cookiebot renders the preference center).
 * Until the Cookiebot script ships, the button degrades to an inline notice
 * instead of a dead click.
 */
export function CookieSettingsButton() {
    const [unavailable, setUnavailable] = useState(false);

    function openSettings() {
        if (window.Cookiebot?.renew) {
            window.Cookiebot.renew();
        } else {
            setUnavailable(true);
        }
    }

    return (
        <div className='my-6 flex flex-col items-start gap-3'>
            <button
                type='button'
                onClick={openSettings}
                className='inline-flex cursor-pointer items-center rounded-full border-none bg-it-primary px-6 py-3 text-[15px] font-medium text-it-primary-fg transition-colors hover:bg-it-primary-hover active:bg-it-primary-active'>
                Open your cookie settings
            </button>
            {unavailable && (
                <p className='m-0 text-[14px] leading-[1.6] text-it-text-muted'>
                    Cookie settings are not available yet. Please check back
                    soon.
                </p>
            )}
        </div>
    );
}
