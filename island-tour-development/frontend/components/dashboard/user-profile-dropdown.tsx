'use client';

import { cn } from '@/lib/utils';
import {
  ArrowDown01Icon,
  CursorInWindowIcon,
  Logout05Icon,
  UserListIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from '@/lib/auth-client';
import UserAvatarImage from './avatar';

interface ProfileDropdownProps {
  loggedInUser: any;
  className?: string;
}

export default function ProfileDropdown({ loggedInUser, className }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        window.open('/', '_blank');
      }
      if (e.metaKey && e.key.toLowerCase() === '/') {
        if (!pathname.includes('/profile')) {
          router.push(`/dashboard/profile`);
        }
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [pathname, router]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // handle click on item
  async function handleItemClick(clickOn: string) {
    setOpen(false);
    switch (clickOn) {
      case 'signOut':
        await signOut({
          fetchOptions: {
            onSuccess: () => {
              queryClient.clear();
              router.push('/portal');
            },
          },
        });
        break;

      default:
        break;
    }
  }

  return (
    <div className='flex justify-center items-center'>
      <div
        className={cn('relative inline-block text-left', className)}
        ref={dropdownRef}
      >
        <div
          className='flex items-center cursor-pointer'
          onClick={() => setOpen(!open)}
        >
          <UserAvatarImage
            user={loggedInUser}
            isVerified={loggedInUser?.isVerified}
          />
          <HugeiconsIcon
            size={16}
            className={cn(
              'text-gray-600 dark:text-gray-400 transition-transform duration-200',
              open && 'rotate-180'
            )}
            icon={ArrowDown01Icon}
          />
        </div>
        {open && (
          <div className='absolute right-[-10px] w-64 bg-background dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden text-xs mt-2'>
            {/* Tail pointing to avatar */}
            <div className='absolute -top-2 right-6 w-4 h-4 bg-background dark:bg-gray-900 border-l border-t border-gray-200 dark:border-gray-700 rotate-45 z-[-1]'></div>

            <div className='p-4'>
              <p className='font-semibold text-gray-900 dark:text-gray-100'>
                {loggedInUser?.name ? loggedInUser.name : 'You'}
              </p>
              <p className='text-gray-500 dark:text-gray-400 text-xs'>
                {loggedInUser?.email}
              </p>
            </div>
            <div className='divide-y divide-gray-200 dark:divide-gray-700'>
              <div className='py-1'>
                <DropdownItem
                  icon={
                    <HugeiconsIcon
                      icon={UserListIcon}
                      size={16}
                    />
                  }
                  label='View Profile'
                  linkTo={
                    !pathname.includes(`/dashboard/profile`) && `/dashboard/profile`
                  }
                  shortcut='⌘ + /'
                  onClick={() => handleItemClick('viewProfile')}
                />
                <Link
                  className='flex bg-primary/10 text-primary justify-between items-center w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-left'
                  onClick={() => handleItemClick('home')}
                  href={`/`}
                  target='_blank'
                >
                  <div className='flex items-center gap-2'>
                    <HugeiconsIcon
                      icon={CursorInWindowIcon}
                      size={16}
                    />
                    Go to Site
                  </div>
                  <span className='text-xs text-gray-400 dark:text-gray-500 font-mono'>
                    ⌘ + H
                  </span>
                </Link>
              </div>
              <div className='py-1'>
                <DropdownItem
                  icon={
                    <HugeiconsIcon
                      icon={Logout05Icon}
                      size={16}
                    />
                  }
                  label='Sign Out'
                  red
                  onClick={() => handleItemClick('signOut')}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface DropdownItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  red?: boolean;
  onClick?: () => void;
  linkTo?: string | false;
}

function DropdownItem({
  icon,
  label,
  shortcut,
  active = false,
  red = false,
  onClick,
  linkTo,
}: DropdownItemProps) {
  const className = cn(
    'flex justify-between items-center cursor-pointer w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-left',
    active
      ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
      : red
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-700 dark:text-gray-300'
  );

  const content = (
    <div className={className} onClick={onClick}>
      <div className='flex items-center gap-2'>
        {icon}
        <span>{label}</span>
      </div>
      {shortcut && (
        <span className='text-xs text-gray-400 dark:text-gray-500 font-mono'>
          {shortcut}
        </span>
      )}
    </div>
  );

  return linkTo ? <Link href={linkTo}>{content}</Link> : content;
}
