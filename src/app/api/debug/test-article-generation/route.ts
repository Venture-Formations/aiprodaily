import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export async function GET() {
  try {
    const campaignId = '3c1c8063-806a-483d-a00a-0eab54d721a5'

    console.log('=== TESTING ARTICLE GENERATION ===')
    console.log('Campaign ID:', campaignId)

    // Get the highest rated post
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        title,
        description,
        content,
        source_url,
        post_ratings(
          total_score,
          interest_level,
          local_relevance,
          community_impact
        )
      `)
      .eq('campaign_id', campaignId)
      .not('post_ratings', 'is', null)
      .limit(10)

    if (postsError || !posts || posts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No rated posts found',
        details: postsError?.message
      }, { status: 404 })
    }

    // Find post with highest rating
    const sortedPosts = posts
      .filter((p: any) => p.post_ratings && p.post_ratings.length > 0)
      .sort((a: any, b: any) => {
        const scoreA = a.post_ratings[0]?.total_score || 0
        const scoreB = b.post_ratings[0]?.total_score || 0
        return scoreB - scoreA
      })

    if (sortedPosts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No posts with ratings found'
      }, { status: 404 })
    }

    const post = sortedPosts[0] as any
    console.log('Testing with post:', {
      id: post.id,
      title: post.title.substring(0, 100),
      rating: post.post_ratings?.[0]
    })

    // Generate newsletter content
    console.log('Generating newsletter content...')
    const newsletterPrompt = await AI_PROMPTS.newsletterWriter({
      title: post.title,
      description: post.description || '',
      content: post.content || '',
      source_url: post.source_url || ''
    })

    console.log('Prompt length:', newsletterPrompt.length)
    console.log('Calling OpenAI...')

    const newsletterResult = await callOpenAI(newsletterPrompt, 500, 0.7)

    console.log('AI Response type:', typeof newsletterResult)
    console.log('AI Response:', newsletterResult)

    // Check if response has required fields
    if (!newsletterResult.headline || !newsletterResult.content || !newsletterResult.word_count) {
      return NextResponse.json({
        success: false,
        error: 'Invalid newsletter content response - missing required fields',
        response_type: typeof newsletterResult,
        has_headline: !!newsletterResult.headline,
        has_content: !!newsletterResult.content,
        has_word_count: !!newsletterResult.word_count,
        response_keys: Object.keys(newsletterResult),
        response: newsletterResult
      }, { status: 500 })
    }

    console.log('Newsletter content generated successfully:', {
      headline: newsletterResult.headline,
      content_length: newsletterResult.content.length,
      word_count: newsletterResult.word_count
    })

    // Fact-check the content
    console.log('Fact-checking content...')
    const factCheckPrompt = await AI_PROMPTS.factChecker(
      JSON.stringify(newsletterResult),
      post.content || post.description || post.title
    )

    const factCheckResult = await callOpenAI(factCheckPrompt, 300, 0.3)

    console.log('Fact-check result:', factCheckResult)

    if (typeof factCheckResult.score !== 'number' || typeof factCheckResult.passed !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'Invalid fact-check response',
        factCheckResult,
        newsletterResult
      }, { status: 500 })
    }

    console.log('Fact-check passed:', factCheckResult.passed, 'Score:', factCheckResult.score)

    return NextResponse.json({
      success: true,
      message: 'Article generation test completed successfully',
      post: {
        id: post.id,
        title: post.title.substring(0, 100),
        rating: post.post_ratings?.[0]
      },
      newsletter: {
        headline: newsletterResult.headline,
        content: newsletterResult.content,
        word_count: newsletterResult.word_count
      },
      fact_check: {
        passed: factCheckResult.passed,
        score: factCheckResult.score,
        accuracy_score: factCheckResult.accuracy_score,
        timeliness_score: factCheckResult.timeliness_score,
        explanation: factCheckResult.explanation
      }
    })

  } catch (error) {
    console.error('Article generation test failed:', error)
    return NextResponse.json({
      error: 'Failed to test article generation',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
