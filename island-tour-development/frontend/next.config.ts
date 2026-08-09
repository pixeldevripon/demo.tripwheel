import type { NextConfig } from 'next';
import path from 'path';

import { ALLOWED_IMAGE_HOSTS } from './lib/images/remote-hosts';

const nextConfig: NextConfig = {
    cacheComponents: true,
    experimental: {
        serverActions: {
            bodySizeLimit: '100mb',
        },
        // Client router cache for DYNAMIC pages (default 0s = every link hop
        // refetches the RSC payload and re-shows the loading skeleton, even
        // when the server would answer from cache). 30s lets short back-and-
        // forth hops - receipt <-> payments, account <-> receipt - replay the
        // payload instantly with NO request and NO skeleton. Mutations stay
        // correct: router.refresh() (used after cancel/date-change/login)
        // bypasses and replaces these entries.
        staleTimes: {
            dynamic: 30,
        },
    },
    turbopack: {
        root: path.resolve(__dirname),
    },
    images: {
        qualities: [100, 75],
        dangerouslyAllowSVG: true,
        contentDispositionType: 'attachment',
        contentSecurityPolicy:
            "default-src 'self'; script-src 'none'; sandbox;",
        // Derived from lib/images/remote-hosts.ts so this list and the render-time
        // guard (safeRemoteImage) can never disagree. Edit the host list there.
        remotePatterns: ALLOWED_IMAGE_HOSTS.map(hostname => ({
            protocol: 'https' as const,
            hostname,
            pathname: '/**',
        })),
    },
    async redirects() {
        return [
            {
                /**
                 * The saved list moved from /wishlist to /saved (mck-17).
                 *
                 * "Wishlist" is an internal word: it stays in the GA4 event
                 * names and the backend module, and nowhere a visitor can read
                 * it - which includes the address bar. The redirect is
                 * permanent because the old path is dead, and it keeps three
                 * things working that would otherwise break silently: links
                 * already emailed by "Email me this list", lists people have
                 * shared with each other, and anyone's bookmark.
                 *
                 * The query string rides along automatically, so a `?restore=`
                 * or `?list=` link survives the hop intact.
                 */
                source: '/:locale/wishlist',
                destination: '/:locale/saved',
                permanent: true,
            },
        ];
    },
};

export default nextConfig;

