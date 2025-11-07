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
}

module.exports = withWorkflow(nextConfig)