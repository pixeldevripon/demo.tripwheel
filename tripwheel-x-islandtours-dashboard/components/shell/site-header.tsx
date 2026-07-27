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
    return (
        <header className='flex h-(--header-height) bg-surface-raised shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) shadow-none border-b border-border/50'>
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
                    <CommandPalette
                        userRole={userRole}
                        userPermissions={userPermissions}
                    />

                    {/*       <HugeiconsIcon
            className="cursor-pointer size-5 text-muted-foreground hover:text-foreground transition-colors"
            icon={Notification01Icon}
          /> */}
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

