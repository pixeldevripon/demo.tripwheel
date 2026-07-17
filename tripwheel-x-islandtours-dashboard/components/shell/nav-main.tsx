'use client';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavGroup } from '@/lib/rbac-utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavMainProps {
  groups: NavGroup[];
}

/**
 * Grouped flat navigation (04 §1.2). Groups arrive already permission-filtered
 * (filterNavGroups) - an empty group never reaches this component.
 *
 * Active state is bg-sidebar-accent PLUS a 2px leading indicator (04 §1.4):
 * color is never the only cue.
 *
 * Nav `url`s are relative and root-less ('trips', '' for Overview), so the
 * href is built here. The dashboard serves at the root - concatenating a '/'
 * root would yield '//trips', which a browser reads as protocol-relative.
 */
const toHref = (url?: string) => (!url ? '/' : `/${url.replace(/^\/+/, '')}`);

export function NavMain({ groups }: NavMainProps) {
  const pathname = usePathname();

  const isPathActive = (url?: string) => {
    const target = toHref(url);
    const normPath = pathname.replace(/\/+$/, '') || '/';
    const normTarget = target.replace(/\/+$/, '') || '/';
    // Overview ('/') matches only exactly; sections own their subtree so
    // /trips/abc/edit still lights Tours.
    if (normTarget === '/') return normPath === '/';
    return normPath === normTarget || normPath.startsWith(`${normTarget}/`);
  };

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label ?? 'main'}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu className='gap-0.5 px-2'>
              {group.items.map((item) => {
                const active = isPathActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={active}
                      className={cn(
                        'relative h-9 rounded-md transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'hover:bg-sidebar-accent/50'
                      )}
                    >
                      <Link href={toHref(item.url)}>
                        {/* 2px leading indicator - the non-color active cue */}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full',
                            active ? 'bg-primary' : 'bg-transparent'
                          )}
                        />
                        {item.icon && <item.icon className='size-4 shrink-0' />}
                        <span className='text-sm'>{item.title}</span>
                        {item.badge != null && (
                          <span className='ml-auto rounded-full bg-primary-subtle px-1.5 text-2xs font-semibold tabular-nums text-primary-subtle-content'>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
