const normalizeUrl = (value) => value.replace(/\/$/, '');

const apiUrl = normalizeUrl(
  process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://api-gateway:8080',
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
