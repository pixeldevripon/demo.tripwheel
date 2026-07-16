'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/lib/rbac-utils';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavMainProps {
  items: NavItem[];
}

export function NavMain({ items }: NavMainProps) {
  const pathname = usePathname();
  const DASH_ROOT = '/dashboard';

  const isPathActive = (url?: string, exact = true) => {
    if (!url || url === '#') return false;
    const target =
      url === ''
        ? DASH_ROOT
        : `${DASH_ROOT}/${url.replace(/^\//g, '')}`;
    
    const normPath = pathname.replace(/\/+$/, '') || '/';
    const normTarget = target.replace(/\/+$/, '') || '/';

    if (exact) {
      return normPath === normTarget;
    }
    return normPath === normTarget || normPath.startsWith(`${normTarget}/`);
  };

  const hasActiveChild = (items?: NavItem[]): boolean => {
    if (!items || !Array.isArray(items)) return false;
    return items.some(
      (item) =>
        (item.url && isPathActive(item.url, false)) ||
        hasActiveChild(item.items),
    );
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className='flex flex-col gap-2 px-3'>
        <SidebarMenu className='gap-1'>
          {items.map((item) => {
            const isItemActive = item.url !== undefined ? isPathActive(item.url, true) : false;
            const hasActiveChildren = hasActiveChild(item.items);
            const isActive = isItemActive || hasActiveChildren;
            const itemHasChildren = item.items && item.items.length > 0;

            if (itemHasChildren) {
              return (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={isActive}
                  className='group/collapsible'
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        className={cn(
                          'h-[46px] rounded-lg hover:bg-sidebar-accent/50 transition-all duration-200',
                          'data-[state=open]:bg-sidebar-accent/30',
                          isActive && 'bg-sidebar-accent/50'
                        )}
                      >
                        {item.icon && (
                          <item.icon className='size-[22px] shrink-0' />
                        )}
                        <span className='font-medium text-[14px] font-general-sans'>
                          {item.title}
                        </span>
                        <ChevronDown className='ml-auto size-4 shrink-0 transition-transform duration-300 ease-out group-data-[state=open]/collapsible:rotate-180' />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent className='overflow-hidden transition-all duration-300 ease-out data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down'>
                      <SidebarMenuSub className='mt-1 ml-0 px-0 py-1 border-0 relative'>
                        {/* Vertical line connector */}
                        <div className='absolute left-[18px] top-0 bottom-0 w-[1.5px] bg-sidebar-accent/30' />

                        {item.items?.map((subItem, index) => {
                          const isSubActive = subItem.url
                            ? isPathActive(subItem.url, true)
                            : false;
                          const isLast = index === (item.items?.length ?? 0) - 1;

                          return (
                            <SidebarMenuSubItem
                              key={subItem.title}
                              className={cn(
                                'mb-0.5 relative',
                                isSubActive && 'text-sidebar-primary-foreground'
                              )}
                            >
                              {/* Curved connector using SVG */}
                              <svg
                                className='absolute left-[18px] top-0 w-6 h-10 text-sidebar-accent/30'
                                viewBox='0 0 24 40'
                                fill='none'
                                xmlns='http://www.w3.org/2000/svg'
                              >
                                <path
                                  d='M 1 0 L 1 20 Q 1 28 9 28 L 24 28'
                                  stroke='currentColor'
                                  strokeWidth='1.5'
                                  fill='none'
                                />
                              </svg>

                              {/* Hide vertical line after last item overlay */}
                              {isLast && (
                                <div className='absolute left-[18px] top-[28px] bottom-0 w-[1.5px] bg-sidebar' />
                              )}

                              <SidebarMenuSubButton
                                asChild
                                isActive={isSubActive}
                                className={cn(
                                  'h-[42px] rounded-lg ml-10 hover:bg-sidebar-accent/50 transition-all duration-200',
                                  isSubActive && 'bg-primary text-primary-foreground font-medium'
                                )}
                              >
                                <Link
                                  href={subItem.url === '' ? DASH_ROOT : `${DASH_ROOT}/${subItem.url}`}
                                >
                                  {subItem.icon && (
                                    <subItem.icon
                                      className={cn(
                                        'size-[18px] shrink-0',
                                        isSubActive && 'text-primary-foreground'
                                      )}
                                    />
                                  )}
                                  <span className='text-[14px] font-general-sans'>
                                    {subItem.title}
                                  </span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            }

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isItemActive}
                  className={cn(
                    'h-[46px] rounded-lg hover:bg-sidebar-accent/50 transition-all duration-200 relative',
                    isItemActive && 'bg-primary text-primary-foreground font-medium'
                  )}
                >
                  <Link
                    className='flex items-center gap-2 h-[46px]'
                    href={item.url === '' ? DASH_ROOT : `${DASH_ROOT}/${item.url}`}
                  >
                    {item.icon && <item.icon className='size-[22px]' />}
                    <span className='font-medium text-[14px] font-general-sans'>
                      {item.title}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
