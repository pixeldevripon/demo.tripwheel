const MasonryLoadingSkeleton = ({ itemCount = 16 }: { itemCount?: number }) => {
    const heightClasses = ['h-[200px]', 'h-[220px]', 'h-[250px]', 'h-[180px]', 'h-[250px]', 'h-[200px]'];
    const skeletonItems = Array.from({ length: itemCount }, (_, index) => ({
        id: index,
        heightClass: heightClasses[index % heightClasses.length],
    }));

    return (
        <div className='w-full overflow-hidden'>
            <div className='w-full columns-[190px] gap-4 [column-fill:balance]'>
                {skeletonItems.map(item => (
                    <div
                        suppressHydrationWarning
                        key={item.id}
                        className={`inline-block w-full mb-4 break-inside-avoid ${item.heightClass}`}>
                        <div className='w-full h-full bg-muted rounded-lg overflow-hidden relative animate-pulse'>
                            <div className='w-full h-full bg-linear-to-r from-muted via-muted-foreground/20 to-muted bg-size-[200%_100%]'>
                                <div className='absolute inset-0 flex items-center justify-center'>
                                    <div className='w-12 h-12 bg-muted-foreground/20 rounded-full flex items-center justify-center'>
                                        <svg className='w-6 h-6 text-muted-foreground/40' fill='currentColor' viewBox='0 0 20 20'>
                                            <path
                                                fillRule='evenodd'
                                                d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z'
                                                clipRule='evenodd'
                                            />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className='absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/20 to-transparent'>
                                <div className='space-y-2'>
                                    <div className='h-3 w-[70%] bg-white/30 rounded animate-pulse' />
                                    <div className='h-2 w-[50%] bg-white/20 rounded animate-pulse' />
                                </div>
                            </div>
                            <div className='absolute top-3 left-3'>
                                <div className='w-8 h-4 bg-muted-foreground/20 rounded-full animate-pulse' />
                            </div>
                            <div className='absolute top-3 right-3 flex gap-2'>
                                <div className='w-8 h-8 bg-white/20 rounded-md animate-pulse' />
                                <div className='w-8 h-8 bg-white/20 rounded-md animate-pulse' />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function MasonrySkeletonWithStyles() {
    return <MasonryLoadingSkeleton />;
}
