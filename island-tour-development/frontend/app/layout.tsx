import QueryProvider from '@/components/providers/query-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import {
    DM_Sans,
    Geist,
    Geist_Mono,
    Inter,
    JetBrains_Mono,
    Noto_Sans,
    Playfair_Display,
} from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const dmSans = DM_Sans({
    variable: '--font-dm-sans',
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
});

const nyghtSerif = localFont({
    variable: '--font-nyght-serif',
    src: [
        {
            path: './fonts/NyghtSerif-Regular.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: './fonts/NyghtSerif-RegularItalic.woff2',
            weight: '400',
            style: 'italic',
        },
    ],
});

const generalSans = localFont({
    variable: '--font-general-sans',
    src: [
        {
            path: './fonts/GeneralSans-Variable.woff2',
            style: 'normal',
        },
        {
            path: './fonts/GeneralSans-VariableItalic.woff2',
            style: 'italic',
        },
    ],
});

const playfairDisplayHeading = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-heading',
});

const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
    variable: '--font-jetbrains-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Island Tours — Admin',
    description:
        'Island Tours admin dashboard — manage trips, bookings, and more.',
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
                geistSans.variable,
                geistMono.variable,
                jetbrainsMono.variable,
                inter.variable,
                dmSans.variable,
                nyghtSerif.variable,
                generalSans.variable,
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
                        </TooltipProvider>
                    </ThemeProvider>
                </QueryProvider>
            </body>
        </html>
    );
}

