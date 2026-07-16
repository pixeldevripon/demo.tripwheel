import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
    // Next 16 Cache Components. Kept from the monorepo config: the dashboard
    // itself is overwhelmingly client-rendered today, but `cacheComponents`
    // governs the whole caching model and turning it off here would be a
    // behavior change, not a simplification.
    cacheComponents: true,

    // Standalone output for the Docker image (Phase 8).
    output: 'standalone',

    experimental: {
        // Media uploads post large payloads through Server Actions. Dropping this
        // breaks the media gallery, so it is load-bearing rather than a leftover.
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
        // Only the two hosts the dashboard actually renders. The public site's
        // demo-seed hosts (picsum.photos, fastly.picsum.photos) and the curated
        // category heroes (images.unsplash.com) are storefront concerns and do
        // not belong in this allowlist.
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                pathname: '/**',
            },
        ],
    },
};

export default nextConfig;
