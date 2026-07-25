/**
 * mollie.js loader + minimal typings for Mollie Components (the inline card
 * form - Mollie's sibling of Stripe Elements). Mollie ships no npm package for
 * the browser SDK; the script MUST load from js.mollie.com (PCI requirement,
 * same rule as Stripe.js).
 */

/** A mounted card input (iframe) - cardNumber / cardHolder / expiryDate / verificationCode. */
export interface MollieComponent {
    mount(target: HTMLElement | string): void;
    unmount(): void;
    addEventListener(
        event: 'change',
        cb: (state: MollieComponentState) => void
    ): void;
}

/** Change-event payload; `error` is already localized by mollie.js. */
export interface MollieComponentState {
    error?: string;
    touched?: boolean;
    dirty?: boolean;
    valid?: boolean;
}

export interface MollieInstance {
    createComponent(
        type: 'cardNumber' | 'cardHolder' | 'expiryDate' | 'verificationCode',
        options?: { styles?: Record<string, unknown> }
    ): MollieComponent;
    createToken(): Promise<{ token?: string; error?: { message?: string } }>;
}

type MollieConstructor = (
    profileId: string,
    options: { locale?: string; testmode?: boolean }
) => MollieInstance;

declare global {
    interface Window {
        Mollie?: MollieConstructor;
    }
}

/** Platform locale → mollie.js locale (same table as the backend mapper). */
export function toMollieJsLocale(locale: string): string | undefined {
    return (
        {
            en: 'en_US',
            nl: 'nl_NL',
            de: 'de_DE',
            fr: 'fr_FR',
            es: 'es_ES',
            pt: 'pt_PT',
        } as Record<string, string>
    )[locale];
}

let loader: Promise<MollieConstructor | null> | null = null;

/**
 * Load mollie.js once (idempotent across mounts/pages) and resolve the global
 * constructor, or null when the script cannot load (blocked network/adblock) -
 * callers fall back to the hosted checkout, never a dead form.
 */
export function loadMollieJs(): Promise<MollieConstructor | null> {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (window.Mollie) return Promise.resolve(window.Mollie);
    if (loader) return loader;
    loader = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://js.mollie.com/v1/mollie.js';
        script.async = true;
        script.onload = () => resolve(window.Mollie ?? null);
        script.onerror = () => {
            loader = null; // allow a retry on the next call
            resolve(null);
        };
        document.head.appendChild(script);
    });
    return loader;
}
