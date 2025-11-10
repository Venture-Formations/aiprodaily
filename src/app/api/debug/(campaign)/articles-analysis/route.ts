import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get all active articles with their headlines and content
    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('id, headline, content, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      count: articles?.length || 0,
      articles: articles || []
    })
  } catch (error) {
    console.error('Error fetching articles:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
