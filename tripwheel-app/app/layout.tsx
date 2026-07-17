import type { Metadata, Viewport } from 'next';
import { DM_Sans, Geist, IBM_Plex_Mono } from 'next/font/google';
import { Toaster } from 'sonner';

import { MarketingCursor } from '@/components/marketing/cursor';
import { SITE_URL } from '@/lib/links';
import './globals.css';

/**
 * TripWheel marketing site - the whole app IS the landing surface, so
 * `.marketing-root` (the token scope from marketing-tokens.css) sits on
 * <body> and every route inherits it.
 *
 * Fonts mirror the dashboard's ramp: DM Sans for headings, Geist for body,
 * IBM Plex Mono for the numeric fragments in the pricing collage.
 */

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

const plexMono = IBM_Plex_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '600'],
    variable: '--font-plex-mono',
});

const TITLE = 'TripWheel - The growth platform for modern travel agencies';
const DESCRIPTION =
    'TripWheel is the purpose-built operating system for travel agencies and tour operators - sell smarter, automate operations, and turn every itinerary into revenue.';

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: TITLE,
        template: '%s | TripWheel',
    },
    description: DESCRIPTION,
    applicationName: 'TripWheel',
    keywords: [
        'travel agency software',
        'tour operator platform',
        'travel booking management',
        'itinerary management software',
        'travel agency CRM',
        'tour business automation',
        'travel payments and invoicing',
        'OTA channel manager',
    ],
    authors: [{ name: 'TripWheel', url: SITE_URL }],
    creator: 'TripWheel',
    publisher: 'TripWheel',
    category: 'technology',
    alternates: { canonical: '/' },
    openGraph: {
        type: 'website',
        url: '/',
        siteName: 'TripWheel',
        locale: 'en_US',
        title: TITLE,
        description: DESCRIPTION,
    },
    twitter: {
        card: 'summary_large_image',
        title: TITLE,
        description: DESCRIPTION,
        images: ['/opengraph-image'],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            'index': true,
            'follow': true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
        },
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#0c0b20',
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html suppressHydrationWarning
            lang='en'
            className={`${dmSans.variable} ${geist.variable} ${plexMono.variable} antialiased`}>
            <body className='marketing-root min-h-screen font-sans'>
                <MarketingCursor />
                {children}
                <Toaster richColors position='bottom-right' />
            </body>
        </html>
    );
}
