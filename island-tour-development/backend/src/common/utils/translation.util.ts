import { Locale } from '@/common/constants/locales';

export const translationSelect = {
  name: true,
  overview: true,
  h1Override: true,
  breadcrumbLabel: true,
  isMachineTranslated: true,
} as const;

export const faqSelect = {
  id: true,
  question: true,
  answer: true,
  displayOrder: true,
  isActive: true,
  locale: true,
  faqGroupId: true,
} as const;

export function applyTranslation<T extends { name: string }>(
  base: T,
  t: { name: string | null; isMachineTranslated: boolean } | undefined,
  locale: Locale,
) {
  return {
    ...base,
    name: t?.name ?? base.name,
    locale,
    isMachineTranslated: t?.isMachineTranslated ?? false,
  };
}
