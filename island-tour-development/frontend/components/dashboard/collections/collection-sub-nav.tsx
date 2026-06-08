'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
}

interface CollectionSubNavProps {
  collectionId: string;
}

export function CollectionSubNav({ collectionId }: CollectionSubNavProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { label: 'Details', href: `/dashboard/collections/${collectionId}/edit` },
    { label: 'Translations', href: `/dashboard/collections/${collectionId}/translations` },
    { label: 'Page Content', href: `/dashboard/collections/${collectionId}/page-content` },
    { label: 'FAQs', href: `/dashboard/collections/${collectionId}/faqs` },
  ];

  return (
    <nav className="flex items-center gap-1 border-b pb-0 mb-6 overflow-x-auto">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative inline-flex h-10 items-center px-4 text-xs font-semibold tracking-wider uppercase whitespace-nowrap transition-colors',
              'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:transition-opacity',
              isActive
                ? 'text-foreground after:bg-foreground after:opacity-100'
                : 'text-muted-foreground hover:text-foreground after:bg-foreground after:opacity-0'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
