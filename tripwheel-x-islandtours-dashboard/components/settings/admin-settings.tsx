'use client';

import { EntityTabs } from '@/components/common/entity-tabs';
import { useRole } from '@/contexts/role-context';
import { CalendarFeedsForm } from './calendar-feeds-form';
import { CustomScriptsForm } from './custom-scripts-form';
import { EmailSettingsForm } from './email-settings-form';
import { IntegrationSettings } from './integration-settings';
import { SeoForm } from './seo-form';
import { SiteInfoForm } from './site-info-form';

/**
 * Admin settings sections, reorganized 2026-07-31 (founder annotation) and
 * again 2026-08-12. Everything that is a THIRD-PARTY hookup - tracking,
 * payments, the social feed, the Trustpilot/Google reviews feed - lives under
 * one "Integration" tab with its own sub-tabs (see `IntegrationSettings`), so
 * the top row reads as what the site IS (Site, SEO), what it plugs into
 * (Integration), what it sends (Email), and the operational surfaces (iCal,
 * Custom Code).
 *
 * The top-level "Reviews" tab is GONE (2026-08-12). It held two unrelated
 * things and both found better homes: the platform-reviews API hookup moved
 * to Integration → Reviews, and the review INVITATION schedule moved to
 * Email → Schedules, beside the other send timings. `?tab=reviews` aliases to
 * `integration`, which opens on its Reviews sub-tab.
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
 * - `integrations` / `payments` / `instagram` / `social` / `reviews` →
 *   `integration`. The raw legacy value STAYS in the URL, and
 *   `IntegrationSettings` reads it to open the matching sub-tab - so
 *   `?tab=payments` (the setup-guide link) still lands on the payment form,
 *   one level deeper, and `?tab=reviews` on the reviews hookup.
 * - `scripts` → `custom-code`.
 *
 * `email` is the email-programme switchboard (`EmailSettingsForm`), moved
 * here from its own /email/settings page (founder request 2026-08-12) so all
 * configuration lives under one Settings roof. The old URL redirects to
 * `?tab=email`.
 *
 * It is the one tab whose gate is not the page's: the switchboard's API is
 * MANAGE_SYSTEM, but the review-invitation card it now hosts answers to
 * VIEW_SETTINGS/MANAGE_SETTINGS. Gating the tab on MANAGE_SYSTEM alone
 * orphaned that card for platform staff, who can never hold MANAGE_SYSTEM
 * (backend `staff.config.ts` → `PLATFORM_STAFF_EXCLUDED`). Hence `canAny`
 * here, with `EmailSettingsForm` itself deciding which cards a seat sees.
 *
 * `calendar` is the one tab here that is NOT platform-wide: an admin holds
 * MANAGE_AVAILABILITY and (per CLAUDE.md rule 19) is auto-provisioned an
 * operator record, so the feeds it mints are that admin's OWN operator's, not
 * every operator's. It is here rather than only on the operator page because
 * ADMIN is a strict superset (rule 3) and this branch renders INSTEAD of
 * `OperatorSettings`, so leaving it out hid the feature from admins entirely.
 */
export function AdminSettings() {
    const { canAny } = useRole();

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
                reviews: 'integration',
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
                ...(canAny(['MANAGE_SYSTEM', 'MANAGE_SETTINGS'])
                    ? [
                          {
                              value: 'email',
                              label: 'Email',
                              content: <EmailSettingsForm />,
                          },
                      ]
                    : []),
                {
                    value: 'calendar',
                    label: 'iCal',
                    content: <CalendarFeedsForm />,
                },
                {
                    value: 'custom-code',
                    label: 'Custom Code',
                    content: <CustomScriptsForm />,
                },
            ]}
        />
    );
}

