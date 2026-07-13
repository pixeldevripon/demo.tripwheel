import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
    async rewrites() {
        // Only proxy requests in production. In development, the frontend talks directly 
        // to localhost:5050 which doesn't have cross-domain cookie issues.
        if (process.env.NODE_ENV !== 'production') {
            return [];
        }

        return [
            {
                source: '/api/:path*',
                destination: 'https://api.islandtours.esenc.cloud/api/:path*',
            },
        ];
    },
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
            // Demo seed image host (picsum.photos redirects to fastly.picsum.photos).
            // Remove together with the demo seed before production.
            {
                protocol: 'https',
                hostname: 'picsum.photos',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'fastly.picsum.photos',
                pathname: '/**',
            },
            // Curated category hero photos (seeded heroImage). Swap for self-hosted
            // assets before production.
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
                pathname: '/**',
            },
        ],
    },
};

export default nextConfig;

