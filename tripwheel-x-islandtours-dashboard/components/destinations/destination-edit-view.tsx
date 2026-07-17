'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDestination } from '@/hooks/destinations/use-destinations';
import { DestinationDetailShell } from './destination-detail-shell';
import { DestinationForm } from './destination-form';
import { DestinationTranslationForm } from './destination-translation-form';
import { DestinationPageContentForm } from './destination-page-content-form';
import { DestinationSeoTab } from './destination-seo-tab';
import { FaqManager } from '@/components/faq/faq-manager';

// Priority order: core details first, then localized content, then SEO polish, then FAQs.
const VALID_TABS = ['details', 'translations', 'page-content', 'seo', 'faqs'] as const;

interface DestinationEditViewProps {
  id: string;
  initialTab?: string;
}

export function DestinationEditView({ id, initialTab }: DestinationEditViewProps) {
  const activeTab =
    initialTab && (VALID_TABS as readonly string[]).includes(initialTab) ? initialTab : 'details';
  const { data: destination, isLoading } = useDestination(id, 'en');

  if (isLoading) {
    return (
      <DestinationDetailShell id={id} name={undefined} isLoading subtitle="Edit destination">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none" />
          ))}
        </div>
      </DestinationDetailShell>
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
      <Tabs defaultValue={activeTab}>
        <div className="pb-2 mb-6">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="translations">Translations</TabsTrigger>
            <TabsTrigger value="page-content">Page Content</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="faqs">FAQs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details">
          <DestinationForm destination={destination} />
        </TabsContent>

        <TabsContent value="translations">
          <DestinationTranslationForm
            destinationId={id}
            destinationName={destination.name}
          />
        </TabsContent>

        <TabsContent value="page-content">
          <DestinationPageContentForm destinationId={id} />
        </TabsContent>

        <TabsContent value="seo">
          <DestinationSeoTab destination={destination} />
        </TabsContent>

        <TabsContent value="faqs">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg font-semibold uppercase tracking-wider">
                FAQs
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <FaqManager basePath="/destinations" entityId={id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DestinationDetailShell>
  );
}
