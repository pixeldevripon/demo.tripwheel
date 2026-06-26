'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface DashboardTabNavItem {
  label: string;
  href: string;
  /** Optional trailing element (e.g. a count badge or status dot). */
  badge?: ReactNode;
  /** Match only the exact pathname. Default also matches nested routes. */
  exact?: boolean;
}

interface DashboardTabNavProps {
  tabs: DashboardTabNavItem[];
  className?: string;
}

/**
 * Route-based tab navigation, styled to match the dashboard Settings tabs.
 *
 * It reuses the shared `<Tabs>` "default" variant (the pill / segmented bar)
 * so every module's sub-nav looks identical to Settings. Each trigger is a
 * Next.js `<Link>` and the active tab is derived from the current pathname.
 *
 * Use for module sub-navs (Details / Translations / Page Content / FAQs / …).
 * For in-page tabbed content (switching panels without navigating), use the
 * `<Tabs>` primitive from `@/components/ui/tabs` directly with its default variant.
 */
export function DashboardTabNav({ tabs, className }: DashboardTabNavProps) {
  const pathname = usePathname();

  const activeHref =
    tabs.find((tab) =>
      tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
    )?.href ??
    tabs[0]?.href ??
    '';

  return (
    <Tabs value={activeHref} activationMode="manual" className={cn('mb-6', className)}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.href} value={tab.href} asChild>
            <Link href={tab.href}>
              {tab.label}
              {tab.badge}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
