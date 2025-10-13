import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('=== STORAGE DEBUG ===')

    // Check if the newsletter-images bucket exists
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()
    console.log('Available buckets:', buckets)
    console.log('Buckets error:', bucketsError)

    // Try to list files in newsletter-images bucket
    const { data: files, error: filesError } = await supabaseAdmin.storage
      .from('newsletter-images')
      .list('articles', { limit: 10 })

    console.log('Files in newsletter-images/articles:', files)
    console.log('Files error:', filesError)

    // Get recent RSS posts to see current image URLs
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, image_url, publication_date')
      .order('publication_date', { ascending: false })
      .limit(5)

    console.log('Recent RSS posts:', posts)

    return NextResponse.json({
      debug: 'Supabase Storage Analysis',
      buckets: buckets || [],
      bucketsError,
      files: files || [],
      filesError,
      posts: posts || [],
      postsError
    })

  } catch (error) {
    console.error('Storage debug error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: 'Failed to analyze storage'
    }, { status: 500 })
  }
}