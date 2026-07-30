import Link from 'next/link';
import { NotificationBell } from '@/components/common/notification-bell';
import { CommandPalette } from '@/components/shell/command-palette';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import ProfileDropdown from '@/components/user-profile-dropdown';

interface SiteHeaderProps {
    userName?: string;
    userEmail?: string;
    userRole?: string;
    userPermissions?: string[];
    userImage?: string | null;
}

export function SiteHeader({
    userName,
    userEmail,
    userRole,
    userPermissions,
    userImage,
}: SiteHeaderProps) {
    // The global availability calendar rides the header, not the sidebar nav -
    // one click from anywhere, same ANY-of gate as the /availability agenda.
    const showCalendar =
        userPermissions?.includes('MANAGE_AVAILABILITY') ||
        userPermissions?.includes('STOP_SELL');
    return (
        <header className='flex h-(--header-height) bg-surface-raised shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) shadow-none border-b border-border/50 md:rounded-t-2xl'>
            <div className='flex flex-1 items-center justify-between gap-1 px-4 lg:gap-2 lg:px-6'>
                <div className='flex items-center gap-2'>
                    {/* Mobile-only: the sidebar is an overlay sheet there and this is the
              only way to open it. On desktop the rail is always visible. */}
                    <SidebarTrigger className='-ml-1 md:hidden' />
                    <Separator
                        orientation='vertical'
                        className='mx-2 data-[orientation=vertical]:h-4 md:hidden'
                    />
                    <h1 className='text-base font-medium font-sans'>
                        Welcome to Tripwheel
                    </h1>
                </div>
                <div className='flex items-center gap-2 md:gap-4'>
                    {showCalendar && (
                        <Link
                            href='/calendar'
                            aria-label='Open the availability calendar'
                            title='Availability calendar'
                            className='relative flex cursor-pointer items-center rounded-md p-1 transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                            {/* A live calendar-page glyph: today's date under
                                the little header strip, like the OS icon. */}
                            <span className='flex size-6 flex-col overflow-hidden rounded-md border border-border bg-background shadow-xs'>
                                <span className='h-1.5 w-full shrink-0 bg-primary' />
                                <span
                                    suppressHydrationWarning
                                    className='flex flex-1 items-center justify-center text-2xs font-semibold leading-none text-foreground'>
                                    {new Date().getDate()}
                                </span>
                            </span>
                        </Link>
                    )}
                    <CommandPalette
                        userRole={userRole}
                        userPermissions={userPermissions}
                    />

                    <NotificationBell />
                    <ProfileDropdown
                        loggedInUser={{
                            name: userName,
                            email: userEmail,
                            role: userRole,
                            image: userImage,
                        }}
                    />
                </div>
            </div>
        </header>
    );
}
