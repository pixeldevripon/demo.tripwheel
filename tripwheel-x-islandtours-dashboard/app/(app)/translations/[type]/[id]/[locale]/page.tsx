import { notFound } from 'next/navigation';

import { TranslationWorkspaceSwitch } from '@/components/translations/workspace/workspace-switch';
import { isLocale } from '@/lib/constants/locales';
import { TRANSLATABLE_ENTITY_TYPES } from '@/lib/translatable-schema';

interface WorkspacePageProps {
  params: Promise<{ type: string; id: string; locale: string }>;
}

export default async function TranslationWorkspacePage({ params }: WorkspacePageProps) {
  const { type, id, locale } = await params;

  if (
    !TRANSLATABLE_ENTITY_TYPES.includes(type as never) ||
    !isLocale(locale)
  ) {
    notFound();
  }


  return (
    <TranslationWorkspaceSwitch
      type={type as (typeof TRANSLATABLE_ENTITY_TYPES)[number]}
      id={id}
      locale={locale}
    />
  );
}
