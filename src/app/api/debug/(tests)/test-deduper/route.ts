import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export const maxDuration = 600

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/test-deduper' },
  async ({ request, logger }) => {
  const { searchParams } = new URL(request.url)
  const issueId = searchParams.get('issue_id')

  if (!issueId) {
    return NextResponse.json({ error: 'issueId required' }, { status: 400 })
  }

  try {
    // Get all rated posts for this issue
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        title,
        description,
        content,
        full_article_text,
        post_ratings!inner(total_score)
      `)
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Query error:', error)
      throw error
    }

    console.log(`Found ${posts?.length || 0} rated posts`)

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No rated posts found for this issue'
      })
    }

    // Prepare post summaries for deduper
    const postSummaries = posts.map(post => ({
      title: post.title,
      description: post.description || '',
      full_article_text: post.full_article_text || post.content || ''
    }))

    console.log('=== TESTING TOPIC DEDUPER ===')
    console.log(`Processing ${postSummaries.length} posts`)
    console.log('Post titles:', postSummaries.map(p => p.title))

    // Call the deduper
    const prompt = await AI_PROMPTS.topicDeduper(postSummaries)
    console.log('=== DEDUPER PROMPT ===')
    console.log(prompt.substring(0, 500) + '...')

    const result = await callOpenAI(prompt)

    console.log('=== DEDUPER RESULT ===')
    console.log('Result type:', typeof result)
    console.log('Has groups?', !!result.groups)
    console.log('Groups length:', result.groups?.length || 0)
    console.log('Full result:', JSON.stringify(result, null, 2))

    return NextResponse.json({
      success: true,
      issue_id: issueId,
      total_posts: posts.length,
      post_titles: postSummaries.map((p, i) => ({ index: i, title: p.title })),
      deduper_result: result,
      duplicate_groups_found: result.groups?.length || 0
    })

  } catch (error) {
    console.error('Test deduper error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)
