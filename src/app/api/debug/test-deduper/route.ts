import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaign_id')

  if (!campaignId) {
    return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
  }

  try {
    // Get all rated posts for this campaign
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        title,
        description,
        post_ratings!inner(total_score)
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Query error:', error)
      throw error
    }

    console.log(`Found ${posts?.length || 0} rated posts`)

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No rated posts found for this campaign'
      })
    }

    // Prepare post summaries for deduper
    const postSummaries = posts.map(post => ({
      title: post.title,
      description: post.description || ''
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
      campaign_id: campaignId,
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
