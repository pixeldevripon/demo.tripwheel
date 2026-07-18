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
 * Admin settings sections. Renames (Phase 20) resolve the old naming
 * collision with the operator view: "General" is really the public site's
 * identity, and "Company" here is the platform's legal entity - not the
 * operator's business (that lives in the operator settings as "Your
 * Business"). Tabs are URL-synced and stay mounted so switching sections
 * never discards unsaved edits.
 */
export function AdminSettings() {
  return (
    <EntityTabs
      basePath="/settings"
      aliases={{ general: 'site', company: 'legal-entity' }}
      tabs={[
        { value: 'site', label: 'Site', content: <SiteInfoForm /> },
        { value: 'seo', label: 'SEO', content: <SeoForm /> },
        { value: 'social', label: 'Social', content: <SocialMediaForm /> },
        { value: 'legal-entity', label: 'Legal Entity', content: <CompanyInfoForm /> },
        { value: 'payments', label: 'Payments', content: <PaymentsForm /> },
        { value: 'integrations', label: 'Integrations', content: <IntegrationsForm /> },
        { value: 'reviews', label: 'Reviews', content: <ReviewsForm /> },
      ]}
    />
  );
}
