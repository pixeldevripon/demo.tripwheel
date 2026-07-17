import QueryProvider from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { DM_Sans, Geist, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

/**
 * Root layout for the dashboard app.
 *
 * Fonts per the Devripon preset (user decision 2026-07-17): DM Sans is the
 * HEADING face (h1-h6 in globals.css + CardTitle via font-heading), Geist
 * the UI/body face, IBM Plex Mono carries code, refs, IDs and money.
 */

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-heading' });

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const ibmPlexMono = IBM_Plex_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '600'],
    variable: '--font-mono-face',
});

export const metadata: Metadata = {
    title: 'Island Tours - Admin',
    description:
        'Island Tours admin dashboard - manage trips, bookings, and more.',
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang='en'
            suppressHydrationWarning
            className={cn(
                'h-full antialiased',
                ibmPlexMono.variable,
                geist.variable,
                'font-sans',
                dmSans.variable
            )}>
            <body suppressHydrationWarning className='min-h-full flex flex-col'>
                <QueryProvider>
                    <ThemeProvider
                        attribute='class'
                        defaultTheme='system'
                        enableSystem
                        disableTransitionOnChange>
                        <TooltipProvider delayDuration={300}>
                            {children}
                            <Toaster richColors />
                        </TooltipProvider>
                    </ThemeProvider>
                </QueryProvider>
            </body>
        </html>
    );
}

