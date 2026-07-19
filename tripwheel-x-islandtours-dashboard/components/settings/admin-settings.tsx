'use client';

import { EntityTabs } from '@/components/common/entity-tabs';
import { CompanyInfoForm } from './company-info-form';
import { IntegrationsForm } from './integrations-form';
import { PaymentsForm } from './payments-form';
import { ReviewsForm } from './reviews-form';
import { SeoForm } from './seo-form';
import { SiteInfoForm } from './site-info-form';
import { SocialMediaForm } from './social-media-form';

/**
 * Admin settings sections. Five tabs: Account (legal entity + social),
 * Site, SEO, Payments, Integrations (integrations + reviews). The old
 * standalone social / legal-entity / reviews tabs are aliased so legacy
 * links land on their new parent. Tabs are URL-synced and stay mounted so
 * switching sections never discards unsaved edits.
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
        reviews: 'integrations',
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
          content: (
            <div className="space-y-6">
              <IntegrationsForm />
              <ReviewsForm />
            </div>
          ),
        },
      ]}
    />
  );
}
