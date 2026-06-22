'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompanyInfoForm } from './company-info-form';
import { IntegrationsForm } from './integrations-form';
import { PaymentsForm } from './payments-form';
import { SeoForm } from './seo-form';
import { SiteInfoForm } from './site-info-form';
import { SocialMediaForm } from './social-media-form';

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'seo', label: 'SEO' },
  { value: 'social', label: 'Social' },
  { value: 'company', label: 'Company' },
  { value: 'payments', label: 'Payments' },
  { value: 'integrations', label: 'Integrations' },
] as const;

export function AdminSettings() {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="flex-wrap">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="general" className="mt-6">
        <SiteInfoForm />
      </TabsContent>
      <TabsContent value="seo" className="mt-6">
        <SeoForm />
      </TabsContent>
      <TabsContent value="social" className="mt-6">
        <SocialMediaForm />
      </TabsContent>
      <TabsContent value="company" className="mt-6">
        <CompanyInfoForm />
      </TabsContent>
      <TabsContent value="payments" className="mt-6">
        <PaymentsForm />
      </TabsContent>
      <TabsContent value="integrations" className="mt-6">
        <IntegrationsForm />
      </TabsContent>
    </Tabs>
  );
}
