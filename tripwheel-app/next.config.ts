import type { NextConfig } from 'next';

/**
 * NEXT_PUBLIC_HOMEPAGE decides what lives at `/`:
 *   - 'landing' (default) - the marketing landing page
 *   - 'login'             - visitors to `/` are sent to the login screen
 *                           (pre-launch mode: the site is just the door)
 *
 * Evaluated at BUILD time - flipping the var on Vercel needs a redeploy.
 * Temporary (307) on purpose: when the landing launches, browsers and
 * crawlers must not remember a permanent redirect.
 */
const homepageIsLogin = process.env.NEXT_PUBLIC_HOMEPAGE === 'login';

const nextConfig: NextConfig = {
    async redirects() {
        if (!homepageIsLogin) return [];
        return [
            {
                source: '/',
                destination: '/login',
                permanent: false,
            },
        ];
    },
};

export default nextConfig;
