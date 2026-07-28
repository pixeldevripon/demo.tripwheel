'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { categoryKeys } from '@/hooks/categories/use-categories';
import { collectionKeys } from '@/hooks/collections/use-collections';
import { destinationKeys } from '@/hooks/destinations/use-destinations';
import { faqGroupKeys } from '@/hooks/faq/use-faq-groups';
import { homePageKeys } from '@/hooks/home-page/use-home-page';
import { hubKeys } from '@/hooks/hubs/use-hubs';
import { pageContentSectionKeys } from '@/hooks/page-content-sections/use-page-content-sections';
import { contentTranslationApi } from '@/lib/api/content-translation';
import type { Locale } from '@/lib/constants/locales';
import { LOCALE_LABELS } from '@/lib/constants/locales';
import type { TranslatableEntityType } from '@/lib/translatable-schema';
import { tripKeys } from '@/lib/trips/query-keys';

/**
 * Root-prefix invalidation per domain: a generate run can touch the main
 * translation, page content, sections, sub-entities and FAQs at once - only
 * the queries a view actively observes refetch anyway. Shared by the
 * per-locale console button and the all-locales editor button.
 */
function invalidateForType(
  queryClient: ReturnType<typeof useQueryClient>,
  type: TranslatableEntityType,
  id: string,
) {
  const invalidate = (queryKey: readonly unknown[]) =>
    queryClient.invalidateQueries({ queryKey });

  switch (type) {
    case 'tour':
      invalidate(tripKeys.all);
      break;
    case 'destination':
      invalidate(destinationKeys.all);
      invalidate(faqGroupKeys.all('/destinations', id));
      invalidate(pageContentSectionKeys.all('/destinations', id));
      break;
    case 'hub':
      invalidate(hubKeys.all);
      invalidate(faqGroupKeys.all('/hubs', id));
      break;
    case 'category':
      invalidate(categoryKeys.all);
      invalidate(faqGroupKeys.all('/categories', id));
      break;
    case 'collection':
      invalidate(collectionKeys.all);
      invalidate(faqGroupKeys.all('/collections', id));
      break;
    case 'homepage':
      invalidate(homePageKeys.all());
      invalidate(faqGroupKeys.all('/home-page', id));
      break;
  }
}

/**
 * The "Translate with AI" button: one entity, the CURRENT locale, synchronous.
 * On success every query the workspace reads is invalidated, so the form
 * re-seeds with the fresh machine translations (the workspaces reset on
 * refetched defaults). Toasts live here so all six workspaces behave alike.
 */
export function useGenerateTranslation(
  type: TranslatableEntityType,
  id: string,
  locale: Locale,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars?: { force?: boolean }) =>
      contentTranslationApi.generate(type, id, locale, vars?.force ?? false),
    onSuccess: (result) => {
      invalidateForType(queryClient, type, id);

      if (result.written > 0) {
        toast.success(
          `Translated ${result.written} field group${result.written === 1 ? '' : 's'} into ${LOCALE_LABELS[locale]} - review before publishing.`,
        );
      } else {
        toast.info(
          'Nothing to translate - everything is already up to date with the current English source.',
        );
      }
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'AI translation failed.',
      );
    },
  });
}

