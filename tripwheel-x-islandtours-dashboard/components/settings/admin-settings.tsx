'use client';

import { EntityTabs } from '@/components/common/entity-tabs';
import { CustomScriptsForm } from './custom-scripts-form';
import { IntegrationSettings } from './integration-settings';
import { ReviewRequestsForm } from './review-requests-form';
import { ReviewsForm } from './reviews-form';
import { SeoForm } from './seo-form';
import { SiteInfoForm } from './site-info-form';

/**
 * Admin settings sections, reorganized 2026-07-31 (founder annotation): six
 * top-level tabs instead of eight. Everything that is a THIRD-PARTY hookup -
 * tracking, payments, the social feed - now lives under one "Integration"
 * tab with its own sub-tabs (see `IntegrationSettings`), so the top row reads
 * as what the site IS (Site, SEO), what it plugs into (Integration), and the
 * operational surfaces (Reviews, iCal, Custom Code).
 *
 * The FIRST tab is the no-`?tab=` default, so Site leads: it is the one every
 * admin opens, and it is where `?tab=general` already pointed. Tabs are
 * URL-synced and stay mounted so switching sections never discards unsaved
 * edits.
 *
 * `SocialMediaForm` (the footer's six social profile URLs) moved from Site to
 * Integration → Social in the same reorg - it now sits with the Instagram
 * feed it is conceptually part of ("everything related to social").
 *
 * "Custom Code" is the renamed Scripts tab - same `CustomScriptsForm`, new
 * value `custom-code` with `scripts` aliased so old bookmarks keep working.
 * It sits LAST rather than next to SEO now, per the founder's ordering; it is
 * still a top-level tab of its own (it executes ARBITRARY THIRD-PARTY CODE on
 * every page including checkout, so it must stay a surface you can audit at a
 * glance, never a card folded into SEO).
 *
 * ## Alias rules (EntityTabs resolves these BEFORE lookup)
 *
 * - `general` / `company` / `legal-entity` / `account` → `site` (legacy Site
 *   sub-surfaces that left this page for `/profile`).
 * - `integrations` / `payments` / `instagram` / `social` → `integration`. The
 *   raw legacy value STAYS in the URL, and `IntegrationSettings` reads it to
 *   open the matching sub-tab - so `?tab=payments` (the setup-guide link)
 *   still lands on the payment form, one level deeper.
 * - `scripts` → `custom-code`.
 *
 * `calendar` is the one tab here that is NOT platform-wide: an admin holds
 * MANAGE_AVAILABILITY and (per CLAUDE.md rule 19) is auto-provisioned an
 * operator record, so the feeds it mints are that admin's OWN operator's, not
 * every operator's. It is here rather than only on the operator page because
 * ADMIN is a strict superset (rule 3) and this branch renders INSTEAD of
 * `OperatorSettings`, so leaving it out hid the feature from admins entirely.
 */
export function AdminSettings() {
    return (
        <EntityTabs
            basePath='/settings'
            aliases={{
                general: 'site',
                company: 'site',
                'legal-entity': 'site',
                account: 'site',
                integrations: 'integration',
                payments: 'integration',
                instagram: 'integration',
                social: 'integration',
                scripts: 'custom-code',
            }}
            tabs={[
                { value: 'site', label: 'Site', content: <SiteInfoForm /> },
                { value: 'seo', label: 'SEO', content: <SeoForm /> },
                {
                    value: 'integration',
                    label: 'Integration',
                    content: <IntegrationSettings />,
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
                /*         {
                    value: 'calendar',
                    label: 'iCal',
                    content: <CalendarFeedsForm />,
                }, */
                {
                    value: 'custom-code',
                    label: 'Custom Code',
                    content: <CustomScriptsForm />,
                },
            ]}
        />
    );
}

