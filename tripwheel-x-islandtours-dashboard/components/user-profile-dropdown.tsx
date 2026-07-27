'use client';

import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import {
    ArrowDown01Icon,
    ArrowRight01Icon,
    ComputerIcon,
    Moon02Icon,
    Sun03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import UserAvatarImage from './avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface ProfileDropdownProps {
    loggedInUser: any;
    className?: string;
}

export default function ProfileDropdown({
    loggedInUser,
    className,
}: ProfileDropdownProps) {
    const router = useRouter();
    const pathname = usePathname();
    const queryClient = useQueryClient();

    // Global keyboard shortcuts (menu open/close + focus is handled by Radix)
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.metaKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                window.open('/', '_blank');
            }
            if (e.metaKey && e.key === '/') {
                if (!pathname.includes('/profile')) {
                    router.push(`/profile`);
                }
            }
        },
        [pathname, router]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    async function handleSignOut() {
        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    queryClient.clear();
                    // Land each role on its own login surface. The
                    // admin login is a separate app on another origin,
                    // so it needs a full navigation, not router.push.
                    if (loggedInUser?.role === 'ADMIN') {
                        window.location.href =
                            process.env.NEXT_PUBLIC_ADMIN_LOGIN_URL ||
                            '/portal';
                    } else if (loggedInUser?.role === 'STAFF') {
                        router.push('/staff');
                    } else if (loggedInUser?.role === 'USER') {
                        router.push('/account');
                    } else {
                        router.push('/portal');
                    }
                },
            },
        });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type='button'
                    aria-label='Open account menu'
                    className={cn(
                        'group flex cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        className
                    )}>
                    <UserAvatarImage
                        user={loggedInUser}
                        isVerified={loggedInUser?.isVerified}
                    />
                    <HugeiconsIcon
                        size={16}
                        className='text-content-muted transition-transform duration-200 group-data-[state=open]:rotate-180'
                        icon={ArrowDown01Icon}
                    />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align='end' sideOffset={8} className='w-64'>
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link href='/profile'>
                            View Profile
                            <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                className='ml-auto text-muted-foreground'
                            />
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a
                            href={
                                process.env.NEXT_PUBLIC_FACING_APP_URL ||
                                'https://islandtours.tripwheel.app'
                            }
                            target='_blank'
                            rel='noreferrer'>
                            Go to Site
                            <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                className='ml-auto text-muted-foreground'
                            />
                        </a>
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <div className='flex items-center justify-between px-3 py-1.5'>
                    <span className='text-xs font-medium text-muted-foreground'>
                        Theme
                    </span>
                    <ThemeSegmentedControl />
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    variant='destructive'
                    onSelect={() => void handleSignOut()}>
                    Sign Out
                    <HugeiconsIcon icon={ArrowRight01Icon} className='ml-auto' />
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

const THEME_OPTIONS = [
    { value: 'light', label: 'Light theme', icon: Sun03Icon },
    { value: 'dark', label: 'Dark theme', icon: Moon02Icon },
    { value: 'system', label: 'System theme', icon: ComputerIcon },
] as const;

function ThemeSegmentedControl() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className='flex items-center gap-0.5 rounded-full bg-muted p-0.5'>
            {THEME_OPTIONS.map((option) => {
                const active = mounted && theme === option.value;
                return (
                    <button
                        key={option.value}
                        type='button'
                        aria-label={option.label}
                        title={option.label}
                        onClick={() => setTheme(option.value)}
                        className={cn(
                            'flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors',
                            active
                                ? 'bg-background text-foreground shadow-sm ring-1 ring-foreground/10'
                                : 'text-muted-foreground hover:text-foreground'
                        )}>
                        <HugeiconsIcon icon={option.icon} size={13} />
                    </button>
                );
            })}
        </div>
    );
}
