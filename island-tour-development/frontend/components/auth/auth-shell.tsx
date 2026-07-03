'use client';

import '@/app/(frontend)/frontend-tokens.css';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import localFont from 'next/font/local';
import Image from 'next/image';

const inkBrush = localFont({
    src: '../../app/fonts/InkBrushArabic_DEMO-Textured.otf',
});

interface AuthShellProps {
    heading: string;
    children: React.ReactNode;
}

export function AuthShell({ heading, children }: AuthShellProps) {
    return (
        <div className='relative min-h-screen overflow-hidden bg-cyan-950'>
            <Image
                src='/auth/island-login-bg.jpg'
                alt=''
                fill
                priority
                sizes='100vw'
                className='object-cover contrast-110   saturate-120'
            />
            <div className='absolute inset-0 bg-linear-to-t from-cyan-950/40 via-transparent to-cyan-900/10' />

            <div className='relative z-10 flex min-h-screen items-center justify-center p-4 py-10 sm:p-8'>
                <div className='relative grid w-full max-w-5xl overflow-hidden rounded-[12px] md:rounded-[40px] shadow-2xl lg:min-h-155 lg:grid-cols-2'>
                    {/* Border painted on top so no seam can show at the corners */}
                    <div className='pointer-events-none absolute inset-0 z-20 rounded-[12px] md:rounded-[40px] border-6 border-white' />
                    {/* Form panel */}
                    <div className='relative bg-white/90 md:bg-white px-7 py-10 sm:px-12 sm:py-12'>
                        {/* Keyed by heading so it crossfades when the auth page
                            changes. Opacity-only (no transform) - a transform would
                            reset the bg-fixed image clip's viewport anchoring. */}
                        <motion.h1
                            key={heading}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
                            className={cn(
                                inkBrush.className,
                                'relative z-10 w-max -ml-6 mb-8 bg-[url(/auth/island-login-bg.jpg)] bg-cover bg-center bg-fixed bg-clip-text text-transparent contrast-110 saturate-120 text-[100px] leading-[1.15] xs:ml-10 xs:text-[120px] lg:-ml-10 lg:text-[154px] drop-shadow-sm pointer-events-none select-none'
                            )}>
                            {heading}
                        </motion.h1>
                        {children}
                    </div>

                    {/* Transparent panel over the scenery */}
                    <div className='hidden lg:flex flex-col justify-between p-10'></div>
                </div>
            </div>
        </div>
    );
}

