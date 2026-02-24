/**
 * Auth Tier System — Declaration Layer
 *
 * Defines the 4-tier auth model for API routes.
 * Phase 1: Declaration only (no enforcement).
 * Phase 3: withApiHandler will enforce these tiers.
 *
 * Tiers:
 *   public        — No auth required (e.g., tools directory, categories)
 *   authenticated — Requires valid session (e.g., dashboard routes)
 *   admin         — Requires admin role in session (e.g., tools admin)
 *   system        — Requires CRON_SECRET bearer token (e.g., cron jobs)
 */

export type AuthTier = 'public' | 'authenticated' | 'admin' | 'system'

export interface RouteConfig {
  /** Which auth tier this route requires */
  authTier: AuthTier
  /** Human-readable description for documentation */
  description?: string
}

/**
 * Declare a route's auth tier. Returns the config unchanged — this is
 * purely for documentation and future enforcement by withApiHandler.
 *
 * Usage in a route file:
 *   export const routeConfig = declareRoute({
 *     authTier: 'system',
 *     description: 'Triggers RSS processing workflow'
 *   })
 */
export function declareRoute(config: RouteConfig): RouteConfig {
  return config
}
