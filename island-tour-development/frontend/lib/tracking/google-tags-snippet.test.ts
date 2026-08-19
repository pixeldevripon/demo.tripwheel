/**
 * The ordering invariant is the compliance property of this whole feature: the
 * Consent Mode v2 defaults must be set before EITHER container can load, or tags
 * fire un-consented for EEA/UK visitors. It lived in three separately-declared
 * template strings with nothing enforcing it - these tests are that enforcement.
 */
import { describe, expect, it } from 'vitest';
import {
    buildGoogleTagsSnippet,
    DENIED_REGIONS,
} from './google-tags-snippet';

const GTM = 'GTM-ABC1234';
const GA4 = 'G-ABC1234567';

describe('buildGoogleTagsSnippet - ordering', () => {
    it('sets consent defaults BEFORE the GTM loader', () => {
        const s = buildGoogleTagsSnippet({ gtmId: GTM, ga4Id: null });
        expect(s.indexOf("gtag('consent','default'")).toBeGreaterThan(-1);
        expect(s.indexOf("gtag('consent','default'")).toBeLessThan(
            s.indexOf('gtm.js?id=')
        );
    });

    it('sets consent defaults BEFORE the GA4 loader', () => {
        const s = buildGoogleTagsSnippet({ gtmId: null, ga4Id: GA4 });
        expect(s.indexOf("gtag('consent','default'")).toBeLessThan(
            s.indexOf('gtag/js?id=')
        );
    });

    it('keeps the full order defaults -> GTM -> GA4 when both are configured', () => {
        const s = buildGoogleTagsSnippet({ gtmId: GTM, ga4Id: GA4 });
        const consent = s.indexOf("gtag('consent','default'");
        const gtm = s.indexOf('gtm.js?id=');
        const ga4 = s.indexOf('gtag/js?id=');
        expect(consent).toBeLessThan(gtm);
        expect(gtm).toBeLessThan(ga4);
    });

    it('declares `gtag` before the GA4 loader calls it', () => {
        // ga4Loader invokes gtag('js', ...) - a reordering that put the loader
        // first would throw at runtime and kill GA4 entirely.
        const s = buildGoogleTagsSnippet({ gtmId: null, ga4Id: GA4 });
        expect(s.indexOf('function gtag(')).toBeGreaterThan(-1);
        expect(s.indexOf('function gtag(')).toBeLessThan(
            s.indexOf("gtag('js'")
        );
    });

    it('emits the consent defaults even when NEITHER container is configured', () => {
        // The component short-circuits before calling this in that case, but the
        // defaults must never be conditional on a container being present.
        const s = buildGoogleTagsSnippet({ gtmId: null, ga4Id: null });
        expect(s).toContain("gtag('consent','default'");
        expect(s).not.toContain('gtm.js?id=');
        expect(s).not.toContain('gtag/js?id=');
    });
});

describe('buildGoogleTagsSnippet - contents', () => {
    it('denies all four v2 signals for the EEA + UK, and grants elsewhere', () => {
        const s = buildGoogleTagsSnippet({ gtmId: GTM, ga4Id: null });
        expect(s).toContain(
            "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500,region:"
        );
        expect(s).toContain("ad_storage:'granted'");
        expect(s).toContain("gtag('set','ads_data_redaction',true)");
    });

    it('covers EU27 + IS/LI/NO + GB in the denied region list', () => {
        expect(DENIED_REGIONS).toHaveLength(31);
        for (const r of ['DE', 'FR', 'NL', 'IS', 'LI', 'NO', 'GB']) {
            expect(DENIED_REGIONS).toContain(r);
        }
        // Not the EEA - must default to granted.
        for (const r of ['US', 'CA', 'CW', 'AW']) {
            expect(DENIED_REGIONS).not.toContain(r);
        }
    });

    it('configures GA4 exactly once, in Google’s documented order', () => {
        // gtag.js does NOT auto-configure from ?id=; `config` is what activates
        // the property. Two configs would be two page_views.
        const s = buildGoogleTagsSnippet({ gtmId: null, ga4Id: GA4 });
        expect(s.match(/gtag\('config'/g)).toHaveLength(1);
        expect(s.indexOf("gtag('js'")).toBeLessThan(s.indexOf("gtag('config'"));
    });

    it('loads each container by inserting an async script, never inline', () => {
        // An inline external write could execute before the defaults.
        const s = buildGoogleTagsSnippet({ gtmId: GTM, ga4Id: GA4 });
        expect(s).toContain('g.async=true');
        expect(s).toContain('j.async=true');
    });

    it('omits a container entirely when its ID is null', () => {
        const gtmOnly = buildGoogleTagsSnippet({ gtmId: GTM, ga4Id: null });
        expect(gtmOnly).toContain(GTM);
        expect(gtmOnly).not.toContain('gtag/js?id=');

        const ga4Only = buildGoogleTagsSnippet({ gtmId: null, ga4Id: GA4 });
        expect(ga4Only).toContain(GA4);
        expect(ga4Only).not.toContain('gtm.js?id=');
    });
});
