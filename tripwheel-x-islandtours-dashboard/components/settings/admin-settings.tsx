'use client';

import { EntityTabs } from '@/components/common/entity-tabs';
import { CompanyInfoForm } from './company-info-form';
import { InstagramForm } from './instagram-form';
import { IntegrationsForm } from './integrations-form';
import { PaymentsForm } from './payments-form';
import { ReviewRequestsForm } from './review-requests-form';
import { ReviewsForm } from './reviews-form';
import { SeoForm } from './seo-form';
import { SiteInfoForm } from './site-info-form';
import { SocialMediaForm } from './social-media-form';

/**
 * Admin settings sections. Seven tabs: Account (legal entity + social), Site,
 * SEO, Payments, Integrations, Reviews (the third-party review feed + the
 * post-tour review request cadence), Instagram (the brand grid on destination
 * pages - its own tab because it is a curation surface, not a credential
 * form). The old standalone social / legal-entity tabs are aliased so legacy
 * links land on their new parent. Tabs are URL-synced and stay mounted so
 * switching sections never discards unsaved edits.
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
        company: 'account',
        'legal-entity': 'account',
        social: 'account',
      }}
      tabs={[
        {
          value: 'account',
          label: 'Account',
          content: (
            <div className="space-y-6">
              <CompanyInfoForm />
              <SocialMediaForm />
            </div>
          ),
        },
        { value: 'site', label: 'Site', content: <SiteInfoForm /> },
        { value: 'seo', label: 'SEO', content: <SeoForm /> },
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
        { value: 'instagram', label: 'Instagram', content: <InstagramForm /> },
      ]}
    />
  );
}
