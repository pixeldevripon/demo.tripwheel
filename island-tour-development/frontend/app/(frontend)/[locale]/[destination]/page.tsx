import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/constants/locales';

/**
 * Destination page — `/[locale]/[destination]` (e.g. /en/curacao).
 * Stub shell for now; the navbar switches to its inner variant on this route.
 * Full design is built section by section.
 */
export default async function DestinationPage({
    params,
}: {
    params: Promise<{ locale: string; destination: string }>;
}) {
    const { locale, destination } = await params;
    if (!isLocale(locale)) notFound();

    return (
        <div className='it-container py-20'>
            <h1 className='font-medium text-[32px] text-it-heading capitalize'>
                {destination.replace(/-/g, ' ')}
            </h1>
            <p className='mt-4 text-it-text-muted'>Destination page — coming soon.</p>
        </div>
    );
}
