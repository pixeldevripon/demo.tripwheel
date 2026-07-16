import QueryProvider from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { JetBrains_Mono, Noto_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';

/**
 * Root layout for the dashboard app.
 *
 * In the monorepo this layout served BOTH the public site and the dashboard,
 * which is why it carried admin metadata over public pages and loaded five
 * fonts for two design systems. Here the repo is the dashboard, so the layout is
 * only ever the dashboard's.
 *
 * Fonts: DM Sans (1 usage) and General Sans (3 usages, a local woff2 pair) were
 * dropped on the way over - see the note in app/globals.css. Playfair Display
 * stays for now at 70 usages; whether it survives is a Phase 11 decision.
 */

const playfairDisplayHeading = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-heading',
});

const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-sans' });

const jetbrainsMono = JetBrains_Mono({
    variable: '--font-jetbrains-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Island Tours - Admin',
    description:
        'Island Tours admin dashboard - manage trips, bookings, and more.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang='en'
            suppressHydrationWarning
            className={cn(
                'h-full antialiased',
                jetbrainsMono.variable,
                'font-sans',
                notoSans.variable,
                playfairDisplayHeading.variable
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
