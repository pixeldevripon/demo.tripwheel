'use client';

import { Button } from '@/components/ui/button';
import { Upload02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

interface NoMediaUiProps {
    searchTerm?: string;
    setIsFormOpen: (open: boolean) => void;
    isDeleting?: boolean;
}

const NoMediaUi = ({
    searchTerm,
    setIsFormOpen,
    isDeleting,
}: NoMediaUiProps) => {
    return (
        <div className='min-h-[60vh] mx-auto flex justify-center items-center p-6'>
            <div className='text-center flex justify-center items-center'>
                <div>
                    <h3 className='text-lg font-medium mb-2 text-foreground'>
                        No media found
                    </h3>
                    <p className='text-muted-foreground mb-6'>
                        {searchTerm
                            ? 'Try adjusting your search terms'
                            : 'Upload your first media files to get started'}
                    </p>
                    {!searchTerm && (
                        <Button
                            variant='outline'
                            onClick={() => setIsFormOpen(true)}
                            disabled={isDeleting}>
                            <HugeiconsIcon
                                icon={Upload02Icon}
                                size={16}
                                className='mr-2'
                            />
                            Upload Media
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NoMediaUi;

