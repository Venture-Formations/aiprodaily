import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const articleId = searchParams.get('id')
    const limit = parseInt(searchParams.get('limit') || '5')

    let articles: any[] = []

    if (articleId) {
      // Get specific article
      const { data, error } = await supabaseAdmin
        .from('articles')
        .select('id, headline, content, word_count, created_at')
        .eq('id', articleId)
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      articles = [data]
    } else {
      // Get recent articles with content
      const { data, error } = await supabaseAdmin
        .from('articles')
        .select('id, headline, content, word_count, created_at')
        .not('content', 'is', null)
        .not('content', 'eq', '')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      articles = data || []
    }

    // Analyze each article's content for newlines
    const analysis = articles.map(article => {
      const content = article.content || ''
      const hasNewlines = content.includes('\n')
      const hasDoubleNewlines = content.includes('\n\n')
      const newlineCount = (content.match(/\n/g) || []).length
      const doubleNewlineCount = (content.match(/\n\n/g) || []).length

      // Show the raw content with visible newline markers
      const contentWithVisibleNewlines = content
        .replace(/\n\n/g, '⏎⏎')
        .replace(/\n/g, '⏎')

      return {
        id: article.id,
        headline: article.headline,
        word_count: article.word_count,
        created_at: article.created_at,
        content_analysis: {
          length: content.length,
          hasNewlines,
          hasDoubleNewlines,
          newlineCount,
          doubleNewlineCount,
        },
        raw_content: content,
        content_with_visible_newlines: contentWithVisibleNewlines,
        html_preview: content.replace(/\n/g, '<br>'),
      }
    })

    return NextResponse.json({
      count: articles.length,
      articles: analysis,
      note: 'If hasDoubleNewlines is false but Claude returned \\n\\n, the newlines were stripped somewhere in the pipeline'
    })

  } catch (error) {
    console.error('Error checking article content:', error)
    return NextResponse.json({
      error: 'Failed to check article content',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
