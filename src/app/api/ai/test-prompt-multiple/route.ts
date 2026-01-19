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
    const { provider, promptJson, publication_id, prompt_type, module_id, limit = 10, offset = 0 } = body

    if (!provider || !promptJson || !publication_id || !prompt_type) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, promptJson, publication_id, prompt_type' },
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
      .from('publications')
      .select('id')
      .eq('slug', publication_id)
      .single()

    if (newsletterError || !newsletter) {
      console.error('[AI Test Multiple] Newsletter not found for slug:', publication_id, newsletterError)
      return NextResponse.json(
        { error: 'Newsletter not found' },
        { status: 404 }
      )
    }

    const newsletterUuid = newsletter.id

    // Calculate cutoff date (7 days ago)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 7)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    let usedPosts: any[] | null = null
    let usedPostsError: any = null

    // If module_id is provided, use module_articles table (new module system)
    if (module_id) {
      console.log('[AI Test Multiple] Fetching posts from sent issues for module_id:', module_id)

      const result = await supabaseAdmin
        .from('module_articles')
        .select(`
          post_id,
          issue_id,
          headline,
          article_module_id,
          rss_posts (
            id,
            title,
            description,
            full_article_text,
            source_url,
            publication_date
          ),
          publication_issues (
            id,
            date,
            status,
            publication_id
          )
        `)
        .eq('article_module_id', module_id)
        .not('post_id', 'is', null)
        .not('headline', 'is', null)
        .limit(200)

      usedPosts = result.data
      usedPostsError = result.error
    } else {
      // Legacy fallback: use articles/secondary_articles based on section
      const section = getSection(prompt_type)
      console.log('[AI Test Multiple] Fetching posts from sent issues for section:', section)

      const articleTable = section === 'secondary' ? 'secondary_articles' : 'articles'

      const result = await supabaseAdmin
        .from(articleTable)
        .select(`
          post_id,
          issue_id,
          headline,
          rss_posts (
            id,
            title,
            description,
            full_article_text,
            source_url,
            publication_date
          ),
          publication_issues (
            id,
            date,
            status,
            publication_id
          )
        `)
        .eq('is_active', true)
        .not('final_position', 'is', null)
        .not('post_id', 'is', null)
        .limit(200)

      usedPosts = result.data
      usedPostsError = result.error
    }

    if (usedPostsError) {
      console.error('[AI Test Multiple] Error fetching posts from sent issues:', usedPostsError)
      return NextResponse.json(
        { error: 'Failed to fetch posts from sent issues', details: usedPostsError.message },
        { status: 500 }
      )
    }

    // Extract and deduplicate the RSS posts, filtering by publication_id, status, and date
    const postsMap = new Map<string, {
      id: string
      title: string
      description: string | null
      full_article_text: string | null
      source_url: string | null
      publication_date: string | null
    }>()

    for (const article of usedPosts || []) {
      const rssPost = article.rss_posts as unknown as {
        id: string
        title: string
        description: string | null
        full_article_text: string | null
        source_url: string | null
        publication_date: string | null
      } | null
      const issue = article.publication_issues as unknown as {
        date: string
        status: string
        publication_id: string
      } | null

      // Filter: must match publication, be sent, and be within date range
      if (!issue) continue
      if (issue.publication_id !== newsletterUuid) continue
      if (issue.status !== 'sent') continue
      if (issue.date < cutoffDateStr) continue

      if (rssPost && !postsMap.has(rssPost.id)) {
        postsMap.set(rssPost.id, rssPost)
      }
    }

    const allPosts = Array.from(postsMap.values())
    const posts = allPosts.slice(offset, offset + limit)

    if (posts.length === 0) {
      return NextResponse.json(
        { error: `No posts found from sent issues in the last 7 days (offset: ${offset}, limit: ${limit}, total available: ${allPosts.length})` },
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
