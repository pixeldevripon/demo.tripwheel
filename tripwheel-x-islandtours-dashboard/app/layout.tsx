import QueryProvider from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Geist, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

/**
 * Root layout for the dashboard app.
 *
 * ONE text face: Geist, for headings and body alike. IBM Plex Mono still
 * carries code, refs, IDs and money.
 *
 * DM Sans was the heading face (user decision 2026-07-17) and has been
 * dropped: two sans-serifs of similar weight and width sat side by side in
 * every header - breadcrumb in Geist, page title in DM Sans - which read as
 * an inconsistency rather than as a hierarchy. Size, weight and tracking do
 * that job on their own, and the second webfont is one fewer network request.
 *
 * `--font-heading` is kept as an ALIAS of the sans stack (globals.css) so the
 * h1-h6 rules and the handful of `font-heading` utilities keep resolving.
 */

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
                'font-sans'
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
                            {/* No `richColors`: it tints the entire toast in
                                the semantic colour, which turns any message
                                longer than a few words into a wall of red.
                                `.cn-toast` in globals.css keeps the surface
                                neutral and spends the colour on the rail and
                                the icon instead. */}
                            <Toaster />
                        </TooltipProvider>
                    </ThemeProvider>
                </QueryProvider>
            </body>
        </html>
    );

    
}

