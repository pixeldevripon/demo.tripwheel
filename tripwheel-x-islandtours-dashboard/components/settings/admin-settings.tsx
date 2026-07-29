'use client';

import { EntityTabs } from '@/components/common/entity-tabs';
import { CalendarFeedsForm } from './calendar-feeds-form';
import { CustomScriptsForm } from './custom-scripts-form';
import { InstagramForm } from './instagram-form';
import { IntegrationsForm } from './integrations-form';
import { PaymentsForm } from './payments-form';
import { ReviewRequestsForm } from './review-requests-form';
import { ReviewsForm } from './reviews-form';
import { SeoForm } from './seo-form';
import { SiteInfoForm } from './site-info-form';
import { SocialMediaForm } from './social-media-form';

/**
 * Admin settings sections, ordered outward from the site itself: what the site
 * IS (Site - identity plus the footer's social links, SEO), where it shows up
 * (Instagram - the brand grid on destination pages, its own tab because it is
 * a curation surface, not a credential form), then what it runs on (Payments,
 * Integrations, Reviews - the third-party review feed + the post-tour review
 * request cadence).
 *
 * The FIRST tab is the no-`?tab=` default, so Site leads: it is the one every
 * admin opens, and it is where `?tab=general` already pointed. Tabs are
 * URL-synced and stay mounted so switching sections never discards unsaved
 * edits.
 *
 * Social folded INTO Site on 2026-07-28 - six optional footer URLs did not
 * earn a tab of their own once the legal entity left the page. Two stacked
 * `SettingsCard`s in one tab is the house pattern (Reviews does the same);
 * each keeps its own Save, so nothing about the write path changes.
 *
 * The platform's legal entity ("Company Information") LEFT this page the same
 * day - it now lives on `/profile` under Company, in the profile page's flat
 * block layout. Its old tab values, and `social`, stay aliased so bookmarked
 * `?tab=social` / `company` / `legal-entity` / `account` links still resolve
 * to a real tab instead of falling through to the first one.
 *
 * `reviews` was previously ALIASED to `integrations` and is now a real tab.
 * The alias had to go: EntityTabs resolves aliases before it looks the value
 * up, so leaving it would have made the new tab unreachable by URL. Legacy
 * `?tab=reviews` links still land on the platform-reviews form they were
 * written for - it just has a tab of its own now.
 *
 * `scripts` sits directly after SEO rather than folded into it. It emits into
 * the same place SEO does (the public head and body), so that is its nearest
 * neighbour and where an admin already goes looking for the GTM field - but it
 * is the one surface here that executes ARBITRARY THIRD-PARTY CODE on every
 * page including checkout, and a thing you audit should not be a card you have
 * to scroll to find.
 *
 * `calendar` is the one tab here that is NOT platform-wide: an admin holds
 * MANAGE_AVAILABILITY and (per CLAUDE.md rule 19) is auto-provisioned an
 * operator record, so the feeds it mints are that admin's OWN operator's, not
 * every operator's. It is here rather than only on the operator page because
 * ADMIN is a strict superset (rule 3) and this branch renders INSTEAD of
 * `OperatorSettings`, so leaving it out hid the feature from admins entirely.
 * It sits last: it is the least platform-shaped thing on the page.
 */
export function AdminSettings() {
    return (
        <EntityTabs
            basePath='/settings'
            aliases={{
                general: 'site',
                social: 'site',
                company: 'site',
                'legal-entity': 'site',
                account: 'site',
            }}
            tabs={[
                {
                    value: 'site',
                    label: 'Site',
                    content: (
                        <div className='space-y-6'>
                            <SiteInfoForm />
                            <SocialMediaForm />
                        </div>
                    ),
                },
                { value: 'seo', label: 'SEO', content: <SeoForm /> },
                {
                    value: 'scripts',
                    label: 'Scripts',
                    content: <CustomScriptsForm />,
                },
                {
                    value: 'instagram',
                    label: 'Instagram',
                    content: <InstagramForm />,
                },
                {
                    value: 'payments',
                    label: 'Payments',
                    content: <PaymentsForm />,
                },
                {
                    value: 'integrations',
                    label: 'Integrations',
                    content: <IntegrationsForm />,
                },
                {
                    value: 'reviews',
                    label: 'Reviews',
                    content: (
                        <div className='space-y-6'>
                            <ReviewRequestsForm />
                            <ReviewsForm />
                        </div>
                    ),
                },
                {
                    value: 'calendar',
                    label: 'iCal sync',
                    content: <CalendarFeedsForm />,
                },
            ]}
        />
    );
}

