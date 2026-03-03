/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Pre-existing lint errors across the codebase; lint separately via `npm run lint`
    ignoreDuringBuilds: true,
  },
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
  // Domain-based rewrites are handled dynamically in middleware.ts
  // No static rewrites needed — new publications auto-route via DB lookup
}

if (process.env.VERCEL) {
  const { withWorkflow } = require('workflow/next')
  module.exports = withWorkflow(nextConfig)
} else {
  module.exports = nextConfig
}
