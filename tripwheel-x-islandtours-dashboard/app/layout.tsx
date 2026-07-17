import QueryProvider from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

/**
 * Root layout for the dashboard app.
 *
 * Fonts: two families, full stop (03 §6, Phase 13). Inter is the body AND
 * heading face - Playfair Display (70 heading usages) was dropped by user
 * decision 2026-07-17: a high-contrast editorial display serif has no place
 * in an operational CRM. DM Sans / General Sans / Noto Sans died earlier
 * (extraction + this phase). JetBrains Mono stays for refs, IDs and money.
 */

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

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
                inter.variable
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
