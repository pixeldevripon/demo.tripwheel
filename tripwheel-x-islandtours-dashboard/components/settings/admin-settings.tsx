'use client';

import { EntityTabs } from '@/components/common/entity-tabs';
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
 */
export function AdminSettings() {
  return (
    <EntityTabs
      basePath="/settings"
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
            <div className="space-y-6">
              <SiteInfoForm />
              <SocialMediaForm />
            </div>
          ),
        },
        { value: 'seo', label: 'SEO', content: <SeoForm /> },
        { value: 'instagram', label: 'Instagram', content: <InstagramForm /> },
        { value: 'payments', label: 'Payments', content: <PaymentsForm /> },
        {
          value: 'integrations',
          label: 'Integrations',
          content: <IntegrationsForm />,
        },
        {
          value: 'reviews',
          label: 'Reviews',
          content: (
            <div className="space-y-6">
              <ReviewRequestsForm />
              <ReviewsForm />
            </div>
          ),
        },
      ]}
    />
  );
}
