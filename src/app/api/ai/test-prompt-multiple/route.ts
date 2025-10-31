import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 600 // 10 minutes for processing multiple articles

// Helper function to inject post data into JSON recursively
function injectPostData(obj: any, post: any): any {
  if (typeof obj === 'string') {
    if (!post) return obj
    return obj
      .replace(/\{\{title\}\}/g, post.title || '')
      .replace(/\{\{description\}\}/g, post.description || 'No description available')
      .replace(/\{\{content\}\}/g, post.full_article_text || 'No content available')
      .replace(/\{\{headline\}\}/g, post.title || '')
      .replace(/\{\{url\}\}/g, post.source_url || '')
  }
  if (Array.isArray(obj)) {
    return obj.map(item => injectPostData(item, post))
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {}
    for (const key in obj) {
      result[key] = injectPostData(obj[key], post)
    }
    return result
  }
  return obj
}

// Helper function to determine section from prompt type
function getSection(promptType: string): 'primary' | 'secondary' | 'all' {
  if (promptType === 'primary-title' || promptType === 'primary-body' || promptType === 'subject-line') return 'primary'
  if (promptType === 'secondary-title' || promptType === 'secondary-body') return 'secondary'
  return 'all'
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, promptJson, newsletter_id, prompt_type, limit = 10 } = body

    if (!provider || !promptJson || !newsletter_id || !prompt_type) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, promptJson, newsletter_id, prompt_type' },
        { status: 400 }
      )
    }

    // Initialize clients inside the function to avoid build-time issues
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Look up the newsletter UUID from the slug
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', newsletter_id)
      .single()

    if (newsletterError || !newsletter) {
      console.error('[AI Test Multiple] Newsletter not found for slug:', newsletter_id, newsletterError)
      return NextResponse.json(
        { error: 'Newsletter not found' },
        { status: 404 }
      )
    }

    const newsletterUuid = newsletter.id

    // Get recent campaigns for this newsletter
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id')
      .eq('newsletter_id', newsletterUuid)
      .order('date', { ascending: false })
      .limit(10) // Get last 10 campaigns

    if (campaignsError) {
      console.error('[AI Test Multiple] Error fetching campaigns:', campaignsError)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns' },
        { status: 500 }
      )
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('[AI Test Multiple] No campaigns found')
      return NextResponse.json(
        { error: 'No campaigns found for this newsletter' },
        { status: 404 }
      )
    }

    const campaignIds = campaigns.map(c => c.id)

    // Get section based on prompt type
    const section = getSection(prompt_type)

    console.log('[AI Test Multiple] Fetching posts for section:', section)

    // Get list of duplicate post IDs to exclude
    const { data: duplicatePosts, error: duplicatesError } = await supabaseAdmin
      .from('duplicate_posts')
      .select('post_id')

    if (duplicatesError) {
      console.error('[AI Test Multiple] Error fetching duplicates:', duplicatesError)
    }

    const duplicatePostIds = duplicatePosts?.map(d => d.post_id) || []
    console.log('[AI Test Multiple] Excluding', duplicatePostIds.length, 'duplicate posts')

    // Fetch posts from the appropriate section
    let query = supabaseAdmin
      .from('rss_posts')
      .select('id, title, description, full_article_text, source_url, publication_date')
      .in('campaign_id', campaignIds)
      .not('full_article_text', 'is', null)  // Exclude posts without full text
      .order('publication_date', { ascending: false })
      .limit(limit)

    // Exclude duplicate posts
    if (duplicatePostIds.length > 0) {
      query = query.not('id', 'in', `(${duplicatePostIds.join(',')})`)
    }

    // Filter by section if not 'all'
    if (section !== 'all') {
      // Get feed IDs for the section - use proper boolean column names
      const sectionField = section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section'
      const { data: feeds, error: feedsError } = await supabaseAdmin
        .from('rss_feeds')
        .select('id')
        .eq('newsletter_id', newsletterUuid)
        .eq(sectionField, true)
        .eq('active', true)

      if (feedsError) {
        console.error('[AI Test Multiple] Error fetching feeds:', feedsError)
        return NextResponse.json(
          { error: 'Failed to fetch RSS feeds' },
          { status: 500 }
        )
      }

      if (!feeds || feeds.length === 0) {
        return NextResponse.json(
          { error: `No active ${section} feeds found` },
          { status: 404 }
        )
      }

      const feedIds = feeds.map(f => f.id)
      query = query.in('feed_id', feedIds)
    }

    const { data: posts, error: postsError } = await query

    if (postsError) {
      console.error('[AI Test Multiple] Error fetching posts:', postsError)
      return NextResponse.json(
        { error: 'Failed to fetch RSS posts' },
        { status: 500 }
      )
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json(
        { error: 'No posts found for testing' },
        { status: 404 }
      )
    }

    console.log(`[AI Test Multiple] Testing ${posts.length} posts`)

    // Process each post
    const startTime = Date.now()
    const responses: any[] = []
    const fullApiResponses: any[] = [] // Store full API responses for debugging
    let totalTokens = 0
    let apiRequestForFirstPost: any = null

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]

      // Inject post data into the JSON request
      const processedJson = injectPostData(promptJson, post)

      // Store API request for the first post only
      if (i === 0) {
        apiRequestForFirstPost = processedJson
      }

      try {
        let response: any
        let tokensUsed = 0
        let fullApiResponse: any = null

        if (provider === 'openai') {
          // Send EXACTLY as-is, only rename messages to input
          const apiRequest = { ...processedJson }

          if (apiRequest.messages) {
            apiRequest.input = apiRequest.messages
            delete apiRequest.messages
          }

          const completion = await (openai as any).responses.create(apiRequest)
          
          // Store the full API response for debugging
          fullApiResponse = completion
          
          // For GPT-5 (reasoning model), search for json_schema content item explicitly
          // since reasoning block may be first item (empty, redacted)
          const outputArray = completion.output?.[0]?.content
          const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
          const textItem = outputArray?.find((c: any) => c.type === "text")
          
          // Try to find JSON in any content item
          let foundJson: any = null
          if (outputArray && Array.isArray(outputArray)) {
            for (const item of outputArray) {
              if (item.json !== undefined) {
                foundJson = item.json
                break
              }
              if (item.input_json !== undefined) {
                foundJson = item.input_json
                break
              }
            }
          }
          
          let rawResponse =
            foundJson ??                                                // JSON found in any content item
            jsonSchemaItem?.json ??                                    // JSON schema response (GPT-5 compatible)
            jsonSchemaItem?.input_json ??                             // Alternative JSON location
            completion.output?.[0]?.content?.[0]?.json ??              // Fallback: first content item (GPT-4o)
            completion.output?.[0]?.content?.[0]?.input_json ??        // Fallback: first input_json
            textItem?.text ??                                         // Text from text content item
            completion.output?.[0]?.content?.[0]?.text ??              // Fallback: first text
            completion.output_text ??                                  // Legacy location
            completion.choices?.[0]?.message?.content ??               // Chat completions format
            'No response'
          
          // If response is a JSON string, parse it; if it's already an object, use it directly
          if (typeof rawResponse === 'string' && rawResponse !== 'No response') {
            try {
              response = JSON.parse(rawResponse)
            } catch {
              response = rawResponse
            }
          } else if (rawResponse !== 'No response') {
            // Already an object (JSON schema returns objects directly)
            response = rawResponse
          } else {
            // Log the completion structure for debugging if we couldn't find a response
            if (i === 0) {
              console.log('[TEST-PROMPT-MULTIPLE] Could not extract response. Completion structure:', JSON.stringify(completion, null, 2))
            }
            response = 'No response'
          }
          
          tokensUsed = completion.usage?.total_tokens || 0
        } else if (provider === 'claude') {
          // Send EXACTLY as-is
          const completion = await anthropic.messages.create(processedJson)
          
          // Store the full API response for debugging
          fullApiResponse = completion
          
          const textContent = completion.content.find(c => c.type === 'text')
          response = textContent && 'text' in textContent ? textContent.text : 'No response'
          tokensUsed = (completion.usage?.input_tokens || 0) + (completion.usage?.output_tokens || 0)
        } else {
          response = 'Invalid provider'
        }

        responses.push(response)
        fullApiResponses.push(fullApiResponse)
        totalTokens += tokensUsed

        // Add a small delay between requests to avoid rate limits
        if (i < posts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        console.error(`[AI Test Multiple] Error processing post ${i + 1}:`, error)
        responses.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        fullApiResponses.push(null) // No full response on error
      }
    }

    const totalDuration = Date.now() - startTime

    console.log(`[AI Test Multiple] Complete: ${responses.length} responses in ${totalDuration}ms`)

    return NextResponse.json({
      success: true,
      responses,
      fullApiResponses, // Full API responses for debugging
      totalTokensUsed: totalTokens,
      totalDuration,
      provider,
      model: promptJson.model || 'unknown',
      apiRequest: apiRequestForFirstPost, // Only first article's API request
      sourcePosts: posts.map(post => ({
        id: post.id,
        title: post.title,
        description: post.description,
        content: post.full_article_text,
        source_url: post.source_url,
        publication_date: post.publication_date
      })), // Include source posts for reference
    })
  } catch (error) {
    console.error('[AI Test Multiple] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to test prompt for multiple articles',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
