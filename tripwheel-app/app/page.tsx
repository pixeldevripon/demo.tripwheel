import { MarketingContact } from '@/components/marketing/contact';
import { MarketingFaq } from '@/components/marketing/faq';
import { MarketingFooter } from '@/components/marketing/footer';
import { MarketingHero } from '@/components/marketing/hero';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingNetworkCta } from '@/components/marketing/network-cta';
import { MarketingPricing } from '@/components/marketing/pricing';
import { FAQS } from '@/lib/faqs';
import { SITE_URL } from '@/lib/links';

/**
 * Structured data for rich results: Organization + WebSite + the product
 * with its self-serve offers, plus FAQPage sourced from the same FAQS array
 * the accordion renders - one source of truth, no drift.
 */
const JSON_LD = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Organization',
            '@id': `${SITE_URL}/#organization`,
            name: 'TripWheel',
            url: SITE_URL,
            logo: `${SITE_URL}/logo/logo-light.svg`,
        },
        {
            '@type': 'WebSite',
            '@id': `${SITE_URL}/#website`,
            url: SITE_URL,
            name: 'TripWheel',
            publisher: { '@id': `${SITE_URL}/#organization` },
        },
        {
            '@type': 'SoftwareApplication',
            name: 'TripWheel',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
                'The purpose-built operating system for travel agencies and tour operators - bookings, itineraries, payments, automation, and growth analytics in one platform.',
            url: SITE_URL,
            offers: [
                { name: 'Starter', price: 199 },
                { name: 'Growth', price: 299 },
                { name: 'Scale', price: 399 },
            ].map(plan => ({
                '@type': 'Offer',
                name: plan.name,
                price: plan.price,
                priceCurrency: 'USD',
                category: 'subscription',
            })),
        },
        {
            '@type': 'FAQPage',
            mainEntity: FAQS.map(faq => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: { '@type': 'Answer', text: faq.answer },
            })),
        },
    ],
};

/**
 * TripWheel SaaS landing page.
 *
 * Boxed-boundary composition: every section lives inside a central frame with
 * full-height hairline side rails, floating over the graph-paper canvas that
 * `.marketing-root` paints (see marketing-tokens.css).
 */
export default function MarketingHomePage() {
    return (
        <>
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
            />
            <MarketingNavbar />
            <main className='mx-auto max-w-[1480px] border-x border-mk-line bg-mk-paper'>
                <MarketingHero />
                <MarketingPricing />
                <MarketingNetworkCta />
                <MarketingFaq />
                <MarketingContact />
                <MarketingFooter />
            </main>
        </>
    );
}

