import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
    cacheComponents: true,
    turbopack: {
        root: path.resolve(__dirname),
    },
    images: {
        qualities: [100, 75],
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

