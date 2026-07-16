'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ProfileHeaderProps {
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    onSave: () => void;
    isLoading?: boolean;
}

export function ProfileHeader({ isEditing, setIsEditing, onSave, isLoading }: ProfileHeaderProps) {
    return (
        <div className='flex flex-col md:flex-row md:items-end justify-between gap-4'>
            <div>
                <h1 className='text-3xl font-bold tracking-tight text-foreground'>
                    My Profile
                </h1>
                <p className='text-muted-foreground mt-1'>
                    Manage your profile information.
                </p>
            </div>
            <div className='flex gap-3'>
                <Button
                    variant={isEditing ? 'outline' : 'default'}
                    onClick={() => setIsEditing(!isEditing)}
                    disabled={isLoading}
                    className='px-6 transition-all duration-200'>
                    {isEditing ? 'Cancel' : 'Edit Profile'}
                </Button>
                {isEditing ? (
                    <Button 
                        onClick={onSave}
                        disabled={isLoading}
                        className='px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2'>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Save Changes
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

