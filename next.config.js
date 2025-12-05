const { withWorkflow } = require('workflow/next')

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['rss-parser'],
  images: {
    domains: ['images.unsplash.com', 'via.placeholder.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Marketing site rewrites for aiaccountingdaily.com
        {
          source: '/',
          has: [{ type: 'host', value: 'aiaccountingdaily.com' }],
          destination: '/website',
        },
        {
          source: '/:path*',
          has: [{ type: 'host', value: 'aiaccountingdaily.com' }],
          destination: '/website/:path*',
        },
      ],
    }
  },
}

module.exports = withWorkflow(nextConfig)
