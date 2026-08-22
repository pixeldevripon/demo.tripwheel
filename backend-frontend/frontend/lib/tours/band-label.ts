/**
 * How a chosen age band is named in a price breakdown: "2 adults", "1 infant".
 *
 * Shared by the booking card and the checkout summary ON PURPOSE. They show the
 * same booking one navigation apart, and they used to word it two ways - the
 * card said "6 adults × $139" while the summary said "6 Adult × $139", which is
 * the same line disagreeing with itself across a page load (Pastel #58).
 *
 * Localized from the band TYPE rather than the operator's free-text label: this
 * is a sentence fragment that has to decline with the count, and an operator's
 * "Adult" is English on all seven locales. An unrecognised type falls back to
 * their noun with the count in front of it.
 *
 * No React, no server/client-only imports - the card renders it in the browser
 * and the checkout summary renders it on the server.
 */
import type { Locale } from '@/lib/constants/locales';
import { formatPlural, type PluralForms } from '@/lib/i18n/plural';

/** The `bands` slice of the booking dictionary, keyed by `bandType`. */
export type BandPluralDict =
    | Record<string, { plural: PluralForms }>
    | undefined;

/** Just enough of a band to name it. */
export interface NameableBand {
    bandType: string;
    /** The operator's own label, e.g. "Adult (13+)" - the fallback. */
    label: string;
}

export function bandCountLabel(
    band: NameableBand,
    count: number,
    bands: BandPluralDict,
    locale: Locale
): string {
    const forms = bands?.[band.bandType]?.plural;
    if (!forms) return `${count} ${band.label.split(' (')[0].trim()}`;
    return formatPlural(forms, count, locale);
}
