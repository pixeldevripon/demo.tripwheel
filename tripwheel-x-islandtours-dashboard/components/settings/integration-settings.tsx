'use client';

/**
 * The Integration tab's three sub-surfaces (founder reorg 2026-07-31): what
 * used to be three TOP-LEVEL tabs - Integrations (tracking), Payments, and
 * Instagram - now live under one "Integration" roof, split by what the
 * third party actually does for the site:
 *
 * - Analytics and Tracking - GTM / pixels / measurement (the old Integrations tab)
 * - Payment - Stripe / Mollie provider config (the old Payments tab)
 * - Social - the Instagram feed curation surface plus the footer's social
 *   profile URLs (the old Instagram tab + the SocialMediaForm that used to
 *   sit inside Site)
 * - Reviews - the Trustpilot / Google platform-reviews hookup (founder reorg
 *   2026-08-12). It is an API key plus a business id, so it belongs with the
 *   other third-party hookups; the top-level Reviews tab it came from is gone,
 *   its other half (when review INVITATION emails go out) having moved to
 *   Settings > Email > Schedules.
 *
 * Sub-tabs mirror EntityTabs' mounting contract: visited panels stay MOUNTED
 * (hidden, not unmounted) so switching never discards unsaved form edits.
 * They are NOT URL-synced - only the top-level `?tab=` is - but legacy
 * bookmarks like `?tab=payments` still land on the right sub-tab: EntityTabs
 * aliases them to `integration` while the RAW value stays in the URL, and the
 * initializer below reads it to pick the opening panel.
 */

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InstagramForm } from './instagram-form';
import { IntegrationsForm } from './integrations-form';
import { PaymentsForm } from './payments-form';
import { ReviewsForm } from './reviews-form';
import { SocialMediaForm } from './social-media-form';

type SubTab = 'tracking' | 'payment' | 'social' | 'reviews';

const SUB_TABS: Array<{ value: SubTab; label: string }> = [
    { value: 'tracking', label: 'Analytics and Tracking' },
    { value: 'payment', label: 'Payment' },
    { value: 'social', label: 'Social' },
    { value: 'reviews', label: 'Reviews' },
];

/** Legacy top-level `?tab=` values → the sub-tab that now owns their content. */
const LEGACY_SUB: Record<string, SubTab> = {
    integrations: 'tracking',
    payments: 'payment',
    instagram: 'social',
    social: 'social',
    reviews: 'reviews',
};

export function IntegrationSettings() {
    const searchParams = useSearchParams();
    const [active, setActive] = useState<SubTab>(() => {
        const legacy = searchParams.get('tab');
        return (legacy && LEGACY_SUB[legacy]) || 'tracking';
    });
    const [visited, setVisited] = useState<Set<SubTab>>(
        () => new Set([active]),
    );

    function switchTab(next: string) {
        const sub = next as SubTab;
        setActive(sub);
        setVisited(prev => (prev.has(sub) ? prev : new Set(prev).add(sub)));
    }

    return (
        <div>
            <Tabs value={active} onValueChange={switchTab}>
                <div className='mb-6'>
                    <TabsList>
                        {SUB_TABS.map(t => (
                            <TabsTrigger key={t.value} value={t.value}>
                                {t.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>
            </Tabs>

            {visited.has('tracking') && (
                <div hidden={active !== 'tracking'}>
                    <IntegrationsForm />
                </div>
            )}
            {visited.has('payment') && (
                <div hidden={active !== 'payment'}>
                    <PaymentsForm />
                </div>
            )}
            {visited.has('social') && (
                <div hidden={active !== 'social'} className='space-y-6'>
                    <InstagramForm />
                    <SocialMediaForm />
                </div>
            )}
            {visited.has('reviews') && (
                <div hidden={active !== 'reviews'}>
                    <ReviewsForm />
                </div>
            )}
        </div>
    );
}
