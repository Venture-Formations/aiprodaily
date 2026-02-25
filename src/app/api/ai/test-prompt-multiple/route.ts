import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { TextBoxGenerator } from '@/lib/text-box-modules/text-box-generator'
import type { TextBoxPlaceholderData } from '@/types/database'

export const maxDuration = 600 // 10 minutes for processing multiple articles

// Helper function to inject post data into JSON recursively
function injectPostData(obj: any, post: any): any {
  if (typeof obj === 'string') {
    let result = obj
    if (post) {
      result = result
        .replace(/\{\{title\}\}/g, post.title || '')
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{summary\}\}/g, post.description || 'No summary available')
        .replace(/\{\{content\}\}/g, post.full_article_text || 'No content available')
        .replace(/\{\{headline\}\}/g, post.title || '')
        .replace(/\{\{url\}\}/g, post.source_url || '')
    }
    // Replace random integer placeholders: {{random_X-Y}}
    result = result.replace(/\{\{random_(\d+)-(\d+)\}\}/g, (match: string, minStr: string, maxStr: string) => {
      const min = parseInt(minStr, 10)
      const max = parseInt(maxStr, 10)
      if (isNaN(min) || isNaN(max) || min > max) {
        console.warn(`[TEST-PROMPT-MULTIPLE] Invalid random placeholder: ${match}`)
        return match // Return unchanged if invalid
      }
      return String(Math.floor(Math.random() * (max - min + 1)) + min)
    })
    return result
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

// Helper function to inject newsletter context placeholders into JSON recursively
function injectNewsletterContext(obj: any, data: TextBoxPlaceholderData): any {
  if (typeof obj === 'string') {
    return TextBoxGenerator.injectPlaceholders(obj, data)
  }
  if (Array.isArray(obj)) {
    return obj.map(item => injectNewsletterContext(item, data))
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {}
    for (const key in obj) {
      result[key] = injectNewsletterContext(obj[key], data)
    }
    return result
  }
  return obj
}

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai/test-prompt-multiple' },
  async ({ request }) => {
    const body = await request.json()
    const { provider, promptJson, publication_id, prompt_type, module_id, limit = 10, offset = 0, isCustomFreeform } = body

    if (!provider || !promptJson || !publication_id || !prompt_type) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, promptJson, publication_id, prompt_type' },
        { status: 400 }
      )
    }

    // Auto-detect Text Box format (has "prompt" field but no "messages"/"input")
    // and convert to full API request format
    let normalizedPromptJson = promptJson
    if (promptJson.prompt && !promptJson.messages && !promptJson.input) {
      console.log('[AI Test Multiple] Detected Text Box format, converting to API request format')

      const textBoxConfig = promptJson as {
        prompt: string
        model?: string
        provider?: string
        system_prompt?: string
        max_tokens?: number
        temperature?: number
      }

      // Build messages array
      const messages: Array<{ role: string; content: string }> = []
      if (textBoxConfig.system_prompt) {
        messages.push({ role: 'system', content: textBoxConfig.system_prompt })
      }
      messages.push({ role: 'user', content: textBoxConfig.prompt })

      // Convert to full API request format
      normalizedPromptJson = {
        model: textBoxConfig.model || 'gpt-4o',
        messages,
        max_tokens: textBoxConfig.max_tokens || 500,
        temperature: textBoxConfig.temperature ?? 0.7
      }
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

    // For Custom/Freeform, test against multiple sent issues instead of RSS posts
    if (isCustomFreeform) {
      return handleCustomFreeformMultiple(
        openai,
        anthropic,
        provider,
        normalizedPromptJson,
        newsletterUuid,
        limit,
        offset
      )
    }

    // Calculate cutoff date (7 days ago)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 7)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    // First get the issue IDs that match our criteria (sent, within date range, for this publication)
    const { data: sentIssues, error: issuesError } = await supabaseAdmin
      .from('publication_issues')
      .select('id')
      .eq('publication_id', newsletterUuid)
      .eq('status', 'sent')
      .gte('date', cutoffDateStr)
      .order('date', { ascending: false })

    if (issuesError) {
      console.error('[AI Test Multiple] Error fetching sent issues:', issuesError)
      return NextResponse.json(
        { error: 'Failed to fetch sent issues', details: issuesError.message },
        { status: 500 }
      )
    }

    const sentIssueIds = sentIssues?.map(i => i.id) || []
    console.log('[AI Test Multiple] Found', sentIssueIds.length, 'sent issues in date range')

    if (sentIssueIds.length === 0) {
      return NextResponse.json(
        { error: 'No sent issues found in the last 7 days' },
        { status: 404 }
      )
    }

    let usedPosts: any[] | null = null
    let usedPostsError: any = null

    // Always use module_articles table for sent issues
    // If module_id is provided, filter by it; otherwise get all posts from all modules
    console.log('[AI Test Multiple] Fetching posts from sent issues', module_id ? `for module_id: ${module_id}` : '(all modules)')

    let query = supabaseAdmin
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
        )
      `)
      .in('issue_id', sentIssueIds)
      .not('post_id', 'is', null)
      .not('headline', 'is', null)
      .not('final_position', 'is', null) // Only posts actually included in sent email

    // Filter by module_id if provided
    if (module_id) {
      query = query.eq('article_module_id', module_id)
    }

    const result = await query.limit(500)

    usedPosts = result.data
    usedPostsError = result.error

    if (usedPostsError) {
      console.error('[AI Test Multiple] Error fetching posts from sent issues:', usedPostsError)
      return NextResponse.json(
        { error: 'Failed to fetch posts from sent issues', details: usedPostsError.message },
        { status: 500 }
      )
    }

    console.log('[AI Test Multiple] Found', usedPosts?.length || 0, 'article records')

    // Extract and deduplicate the RSS posts (already filtered by issue_id at database level)
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
      const processedJson = injectPostData(normalizedPromptJson, post)

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
      model: normalizedPromptJson.model || 'unknown',
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
  }
)

/**
 * Handle Custom/Freeform multiple testing - tests against multiple sent issues
 * instead of multiple RSS posts
 */
async function handleCustomFreeformMultiple(
  openai: OpenAI,
  anthropic: Anthropic,
  provider: string,
  promptJson: any,
  publicationId: string,
  limit: number,
  offset: number
) {
  // Get sent issues (no date limit - get all sent issues, ordered by most recent)
  const { data: sentIssues, error: issuesError } = await supabaseAdmin
    .from('publication_issues')
    .select('id, date, final_sent_at')
    .eq('publication_id', publicationId)
    .eq('status', 'sent')
    .order('final_sent_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (issuesError) {
    console.error('[AI Test Multiple Custom] Error fetching sent issues:', issuesError)
    return NextResponse.json(
      { error: 'Failed to fetch sent issues', details: issuesError.message },
      { status: 500 }
    )
  }

  if (!sentIssues || sentIssues.length === 0) {
    return NextResponse.json(
      { error: `No sent issues found (offset: ${offset}, limit: ${limit})` },
      { status: 404 }
    )
  }

  console.log(`[AI Test Multiple Custom] Testing ${sentIssues.length} issues (offset: ${offset})`)

  // Process each issue
  const startTime = Date.now()
  const responses: any[] = []
  const fullApiResponses: any[] = []
  let totalTokens = 0
  let apiRequestForFirstIssue: any = null

  for (let i = 0; i < sentIssues.length; i++) {
    const issue = sentIssues[i]

    try {
      // Build placeholder data for this issue (full context)
      const placeholderData = await TextBoxGenerator.buildPlaceholderData(issue.id, 'after_articles')

      // Inject newsletter context placeholders
      const processedJson = injectNewsletterContext(promptJson, placeholderData)

      // Store API request for the first issue only
      if (i === 0) {
        apiRequestForFirstIssue = processedJson
      }

      let response: any
      let tokensUsed = 0
      let fullApiResponse: any = null

      if (provider === 'openai') {
        const apiRequest = { ...processedJson }

        if (apiRequest.messages) {
          apiRequest.input = apiRequest.messages
          delete apiRequest.messages
        }

        const completion = await (openai as any).responses.create(apiRequest)
        fullApiResponse = completion

        // Extract response (same logic as regular multiple test)
        const outputArray = completion.output?.[0]?.content
        const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
        const textItem = outputArray?.find((c: any) => c.type === "text")

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
          foundJson ??
          jsonSchemaItem?.json ??
          jsonSchemaItem?.input_json ??
          completion.output?.[0]?.content?.[0]?.json ??
          completion.output?.[0]?.content?.[0]?.input_json ??
          textItem?.text ??
          completion.output?.[0]?.content?.[0]?.text ??
          completion.output_text ??
          completion.choices?.[0]?.message?.content ??
          'No response'

        if (typeof rawResponse === 'string' && rawResponse !== 'No response') {
          try {
            response = JSON.parse(rawResponse)
          } catch {
            response = rawResponse
          }
        } else if (rawResponse !== 'No response') {
          response = rawResponse
        } else {
          response = 'No response'
        }

        tokensUsed = completion.usage?.total_tokens || 0
      } else if (provider === 'claude') {
        const completion = await anthropic.messages.create(processedJson)
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
      if (i < sentIssues.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error(`[AI Test Multiple Custom] Error processing issue ${i + 1}:`, error)
      responses.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      fullApiResponses.push(null)
    }
  }

  const totalDuration = Date.now() - startTime

  console.log(`[AI Test Multiple Custom] Complete: ${responses.length} responses in ${totalDuration}ms`)

  return NextResponse.json({
    success: true,
    responses,
    fullApiResponses,
    totalTokensUsed: totalTokens,
    totalDuration,
    provider,
    model: promptJson.model || 'unknown',
    apiRequest: apiRequestForFirstIssue,
    // For Custom/Freeform, return issue info instead of posts
    sourceIssues: sentIssues.map(issue => ({
      id: issue.id,
      date: issue.date,
      sent_at: issue.final_sent_at
    })),
    isCustomFreeform: true
  })
}
