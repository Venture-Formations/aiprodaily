/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Pre-existing lint errors across the codebase; lint separately via `npm run lint`
    ignoreDuringBuilds: true,
  },
  // xdg-portable/xdg-app-paths (pulled transitively by workflow@4.x via
  // @vercel/functions -> @vercel/oidc -> @vercel/cli-config) call
  // path.parse(module.filename) at import; webpack bundling leaves
  // module.filename undefined, crashing `next build` page-data collection.
  // Externalizing them so they're require()'d at runtime keeps filename defined.
  serverExternalPackages: ['rss-parser', 'xdg-portable', 'xdg-app-paths'],
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
