import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
    // Next 16 Cache Components. Kept from the monorepo config: the dashboard
    // itself is overwhelmingly client-rendered today, but `cacheComponents`
    // governs the whole caching model and turning it off here would be a
    // behavior change, not a simplification.
    cacheComponents: true,

    // NO `output: 'standalone'` HERE, ON PURPOSE. It was added in Phase 5 for a
    // Docker image that Phase 8 then decided not to build: the dashboard deploys
    // to Vercel, like the public site. `standalone` is a self-hosting feature
    // (it emits `.next/standalone` + a minimal `server.js` to run instead of
    // `next start`); Vercel builds through its own pipeline and ignores it. If
    // this app is ever moved onto a container host, put it back - that is the
    // one thing it is for.

    experimental: {
        // NOT what it looks like: no Server Action in this app takes a file.
        // Media uploads go browser -> backend DIRECTLY (`mediaApi.upload` ->
        // `apiFetch` -> NEXT_PUBLIC_BACKEND_URL/media-gallery/upload), so they
        // never traverse Next and this limit never applies to them. The five
        // actions we do have (onboardOperator, setPasswordAction,
        // revalidateCacheTags, getUserProfile, getDashboardStats) all carry
        // small JSON, far under the 1mb default.
        //
        // So this is vestigial, and on Vercel it is also unenforceable: the
        // platform caps any function request body at 4.5mb and returns 413
        // FUNCTION_PAYLOAD_TOO_LARGE before Next is reached. Kept only because
        // deleting app config is not this phase's job - see 06 Phase 8. If you
        // ever route an upload through a Server Action, this number is a promise
        // Vercel will not keep; use the direct-to-backend path instead.
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
