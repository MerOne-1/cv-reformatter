/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdf-parse', 'officeparser'],
  transpilePackages: ['@react-pdf/renderer'],
  webpack: (config, { isServer }) => {
    // Handle pdf-parse which uses fs
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
