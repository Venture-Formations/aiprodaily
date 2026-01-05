import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_CALL } from '@/lib/openai'
import { authOptions } from '@/lib/auth'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Fetch issue with publication_id
    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .select('*, publication_id')
      .eq('id', id)
      .single()

    if (error) {
      console.error('issue fetch error:', error)
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    if (!issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    // Fetch module articles with their article_module's display_order
    // to ensure we use the #1 article from the FIRST section (lowest display_order)
    const { data: moduleArticles, error: articlesError } = await supabaseAdmin
      .from('module_articles')
      .select(`
        headline,
        content,
        is_active,
        skipped,
        rank,
        article_module_id,
        article_module:article_modules(display_order),
        rss_post:rss_posts(
          post_rating:post_ratings(total_score)
        )
      `)
      .eq('issue_id', id)
      .eq('is_active', true)

    if (articlesError) {
      console.error('articles fetch error:', articlesError)
      return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
    }

    // Get active articles sorted by module display_order first, then by rank
    // This ensures we use the #1 article from the FIRST article section
    const activeArticles = (moduleArticles || [])
      .filter((article: any) => {
        // Check skipped only if the field exists
        if (article.hasOwnProperty('skipped') && article.skipped) return false
        return true
      })
      .sort((a: any, b: any) => {
        // First sort by article_module display_order (lower = first section)
        const aModuleOrder = a.article_module?.display_order ?? 999
        const bModuleOrder = b.article_module?.display_order ?? 999
        if (aModuleOrder !== bModuleOrder) {
          return aModuleOrder - bModuleOrder
        }
        // Then sort by rank within the same module
        return (a.rank || 999) - (b.rank || 999)
      })

    if (activeArticles.length === 0) {
      return NextResponse.json({
        error: 'No active articles found for subject line generation'
      }, { status: 400 })
    }

    // Use the #1 ranked article (rank 1) for subject line generation
    const topArticle = activeArticles[0]
    console.log(`[Subject Line] Using article: "${topArticle.headline}" (rank: ${topArticle.rank || 'unranked'})`)

    // Get publication_id from issue
    const newsletterId = issue.publication_id
    if (!newsletterId) {
      return NextResponse.json({
        error: 'issue missing publication_id'
      }, { status: 400 })
    }

    // Generate subject line using AI_CALL (handles prompt + provider + call)
    const result = await AI_CALL.subjectLineGenerator(topArticle, newsletterId, 100, 0.8)

    // Handle both plain text and JSON responses
    let subjectLine = ''
    if (typeof result === 'string') {
      subjectLine = result.trim()
    } else if (result && typeof result === 'object') {
      if (result.subject_line) {
        subjectLine = result.subject_line.trim()
      } else if (result.raw) {
        subjectLine = result.raw.trim()
      } else {
        subjectLine = String(result).trim()
      }
    } else {
      subjectLine = String(result).trim()
    }

    if (!subjectLine) {
      throw new Error('Empty subject line response from AI')
    }

    // Update issue with generated subject line
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        subject_line: subjectLine
      })
      .eq('id', id)

    if (updateError) {
      console.error('Failed to update issue with subject line:', updateError)
      // Continue anyway - we still return the generated subject line
    }

    console.log(`Generated subject line: "${subjectLine}" (${subjectLine.length} chars)`)

    // Log user activity
    if (session.user?.email) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            issue_id: id,
            action: 'subject_line_generated',
            details: {
              subject_line: subjectLine,
              character_count: subjectLine.length,
              top_article_headline: topArticle.headline,
              top_article_score: topArticle.rss_post?.[0]?.post_rating?.[0]?.total_score || 0
            }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      subject_line: subjectLine,
      character_count: subjectLine.length,
      top_article_used: topArticle.headline,
      top_article_score: topArticle.rss_post?.[0]?.post_rating?.[0]?.total_score || 0
    })

  } catch (error) {
    console.error('Failed to generate subject line:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      error: `Failed to generate subject line: ${errorMessage}`,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}