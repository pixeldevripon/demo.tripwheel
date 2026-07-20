import type { NextConfig } from 'next';
import path from 'path';

import { ALLOWED_IMAGE_HOSTS } from './lib/images/remote-hosts';

const nextConfig: NextConfig = {
    cacheComponents: true,
    experimental: {
        serverActions: {
            bodySizeLimit: '100mb',
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
};

export default nextConfig;

