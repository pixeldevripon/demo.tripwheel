'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityEditSkeleton } from '@/components/common/entity-edit-skeleton';
import { EntityTabs } from '@/components/common/entity-tabs';
import { useDestination } from '@/hooks/destinations/use-destinations';
import { DestinationDetailShell } from './destination-detail-shell';
import { DestinationForm } from './destination-form';
import { EnglishContentEditor } from '@/components/common/english-content-editor';
import { DestinationPageContentForm } from './destination-page-content-form';
import { DestinationSeoTab } from '@/components/common/entity-seo-tab';
import { FaqManager } from '@/components/common/faq-manager';
import { ContentSectionManager } from '@/components/common/content-section-manager';

interface DestinationEditViewProps {
  id: string;
  initialTab?: string;
}

export function DestinationEditView({ id, initialTab }: DestinationEditViewProps) {
  const { data: destination, isLoading } = useDestination(id, 'en');

  if (isLoading) {
    return (
      <EntityEditSkeleton />
    );
  }

  if (!destination) {
    return (
      <DestinationDetailShell id={id} name={undefined} isLoading={false} subtitle="Edit destination">
        <p className="text-sm text-muted-foreground">Destination not found.</p>
      </DestinationDetailShell>
    );
  }

  return (
    <DestinationDetailShell
      id={id}
      name={destination.name}
      isLoading={false}
      subtitle="Edit destination"
    >
      <EntityTabs
        basePath={`/destinations/${id}/edit`}
        initialTab={initialTab}
        aliases={{ translations: 'page-content' }}
        tabs={[
          {
            value: 'details',
            label: 'Details',
            content: <DestinationForm destination={destination} />,
          },
          {
            value: 'page-content',
            label: 'Page Content',
            content: (
              <div className="space-y-6">
                <EnglishContentEditor type="destination" id={id} />
                <DestinationPageContentForm destinationId={id} />
                {/* Lives inside Page Content rather than as a fifth tab: these
                    blocks render in the same About band as the copy above, and
                    the entity tab set (Details / Page Content / SEO / FAQs) is
                    shared across every module. */}
                <Card>
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-lg font-semibold">
                      About Sections
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ContentSectionManager basePath="/destinations" entityId={id} />
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            value: 'seo',
            label: 'SEO',
            content: <DestinationSeoTab destination={destination} />,
          },
          {
            value: 'faqs',
            label: 'FAQs',
            content: (
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-lg font-semibold">FAQs</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <FaqManager basePath="/destinations" entityId={id} />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </DestinationDetailShell>
  );
}
