'use client';
import Image from 'next/image';
import { useState } from 'react';

interface UserAvatarImageProps {
    user: any;
    isVerified?: boolean;
    onClick?: () => void;
}

export default function UserAvatarImage({
    user,
    isVerified,
    onClick,
}: UserAvatarImageProps) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);

    const userInitial = user?.name?.[0] || user?.email?.[0] || '?';

    // Only set userImage if there's actually an image available
    const userImage = user?.image
        ? typeof user.image === 'string'
            ? user.image
            : user.image.url
        : null;

    // Rendered inside the profile dropdown's trigger <button>, so this
    // must not be a button itself (nested buttons are invalid HTML).
    return (
        <span
            onClick={onClick}
            className='flex items-center gap-3 p-2 bg-transparent duration-300 transition-colors cursor-pointer'>
            <div className='relative w-9 h-9'>
                {/* Fallback - show when no image, image has error, or hasn't loaded yet */}
                {(!userImage || !imgLoaded || imgError) && (
                    <div className='absolute inset-0 flex items-center justify-center w-full h-full bg-primary text-white text-lg font-medium rounded-full'>
                        {userInitial}
                    </div>
                )}

                {/* High-quality Image - only render if userImage exists */}
                {userImage && !imgError && (
                    <Image
                        src={userImage}
                        alt='User Avatar'
                        width={128}
                        height={128}
                        quality={100}
                        priority
                        onLoad={() => setImgLoaded(true)}
                        onError={() => {
                            setImgError(true);
                            setImgLoaded(false);
                        }}
                        className={`rounded-full object-cover w-full h-full shadow-inner border-2 border-line transition-opacity duration-300 ${
                            imgLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                        sizes='(max-width: 768px) 48px, (max-width: 1200px) 64px, 72px'
                    />
                )}
            </div>
        </span>
    );
}

