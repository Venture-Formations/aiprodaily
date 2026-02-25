import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'

/**
 * DEPRECATED: Image URLs are now stored in Supabase Storage.
 * Use the publication_business_settings table to manage header/logo URLs.
 * Use the migration endpoint at /api/debug/(maintenance)/migrate-images-to-supabase
 * to migrate remaining GitHub-hosted images.
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/update-image-urls' },
  async ({ logger }) => {
  return NextResponse.json({
    success: false,
    message: 'This endpoint is deprecated. Image URLs are now managed via Supabase Storage and publication_business_settings.',
  })
  }
)
