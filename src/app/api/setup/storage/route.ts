import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'setup/storage' },
  async ({ logger }) => {
    logger.info('Setting up Supabase storage')

    const bucketsToCreate = [
      {
        name: 'img',
        options: {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
          fileSizeLimit: 10485760, // 10MB
        }
      },
      {
        name: 'newsletter-images',
        options: {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          fileSizeLimit: 5242880, // 5MB
        }
      },
    ]

    const results: Record<string, string> = {}

    for (const { name, options } of bucketsToCreate) {
      const { error } = await supabaseAdmin.storage.createBucket(name, options)

      if (error && !error.message.includes('already exists')) {
        results[name] = `Error: ${error.message}`
      } else {
        results[name] = error ? 'Already exists' : 'Created'
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Storage buckets configured',
      buckets: results,
    })
  }
)
