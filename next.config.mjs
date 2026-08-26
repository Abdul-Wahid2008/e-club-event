/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
      {
        // PERFORMANCE: static assets under /public (logos, favicons) were
        // being served with Cache-Control: max-age=0, must-revalidate --
        // every single request re-fetched the full file instead of using
        // the browser cache, adding avoidable load on venue wifi with ~150
        // concurrent phones. These files are content-static for the
        // duration of the event; cache them for a year.
        source: '/:path*.(png|jpg|jpeg|svg|webp|ico)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
