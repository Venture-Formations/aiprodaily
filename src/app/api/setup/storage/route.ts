import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('=== SETTING UP SUPABASE STORAGE ===')

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

  } catch (error) {
    console.error('Storage setup error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to setup Supabase Storage'
    }, { status: 500 })
  }
}