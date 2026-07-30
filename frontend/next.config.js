const normalizeUrl = (value) => value.replace(/\/$/, '');

const apiUrl = normalizeUrl(
  process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://api-gateway:8080',
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    // Course thumbnails may be served from arbitrary external hosts; allow any
    // https source. CourseCard falls back to a generated gradient cover when
    // no thumbnailUrl is present.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    instrumentationHook: true,
  },
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
