import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { TextBoxGenerator } from '@/lib/text-box-modules/text-box-generator'
import type { TextBoxPlaceholderData } from '@/types/database'

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const maxDuration = 600

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, promptJson, post, publication_id, isCustomFreeform } = body

    // Validate provider matches model
    const modelName = (promptJson?.model || '').toLowerCase()
    const isClaude = modelName.includes('claude')
    const isOpenAI = modelName.includes('gpt') || modelName.includes('o1') || modelName.includes('o3')

    if (isClaude && provider === 'openai') {
      return NextResponse.json(
        { error: `Model "${promptJson.model}" is a Claude model. Please select "Claude" as the provider.` },
        { status: 400 }
      )
    }
    if (isOpenAI && provider === 'claude') {
      return NextResponse.json(
        { error: `Model "${promptJson.model}" is an OpenAI model. Please select "OpenAI" as the provider.` },
        { status: 400 }
      )
    }

    // Start with the prompt JSON
    let processedJson = promptJson

    // For Custom/Freeform, inject newsletter context placeholders from most recent sent issue
    if (isCustomFreeform && publication_id) {
      const { supabaseAdmin } = await import('@/lib/supabase')

      // Get most recent sent issue
      const { data: lastIssue } = await supabaseAdmin
        .from('publication_issues')
        .select('id')
        .eq('publication_id', publication_id)
        .eq('status', 'sent')
        .order('final_sent_at', { ascending: false })
        .limit(1)
        .single()

      if (lastIssue) {
        // Build placeholder data from the last sent issue (always use after_articles for full context)
        const placeholderData = await TextBoxGenerator.buildPlaceholderData(lastIssue.id, 'after_articles')

        // Inject newsletter context placeholders first
        processedJson = injectNewsletterContext(processedJson, placeholderData)

        console.log('[TEST-PROMPT] Injected newsletter context from issue:', lastIssue.id)
      } else {
        console.log('[TEST-PROMPT] No sent issues found for publication:', publication_id)
      }
    }

    // Inject post data (RSS post placeholders) into the JSON request
    processedJson = injectPostData(processedJson, post)

    const startTime = Date.now()
    let response: string
    let tokensUsed: number | undefined
    let fullApiResponse: any = null // Store full API response for debugging
    const apiRequest = processedJson // Store the exact API request

    if (provider === 'openai') {
      // OpenAI API call - send EXACTLY as-is, only rename messages to input
      const apiRequest = { ...processedJson }

      if (apiRequest.messages) {
        apiRequest.input = apiRequest.messages
        delete apiRequest.messages
      }

      console.log('[TEST-PROMPT] Full API request being sent to OpenAI:', JSON.stringify(apiRequest, null, 2))

      const completion = await (openai as any).responses.create(apiRequest)

      // Store the full API response for debugging
      fullApiResponse = completion

      console.log('[TEST-PROMPT] Raw API response:', JSON.stringify(completion, null, 2))

      // Try multiple response formats
      // For GPT-5 (reasoning model), search for json_schema content item explicitly
      // since reasoning block may be first item (empty, redacted)
      const outputArray = completion.output?.[0]?.content
      const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
      const textItem = outputArray?.find((c: any) => c.type === "text")

      let rawResponse =
        jsonSchemaItem?.json ??                                    // JSON schema response (GPT-5 compatible)
        jsonSchemaItem?.input_json ??                             // Alternative JSON location
        completion.output?.[0]?.content?.[0]?.json ??              // Fallback: first content item (GPT-4o)
        completion.output?.[0]?.content?.[0]?.input_json ??        // Fallback: first input_json
        textItem?.text ??                                         // Text from text content item
        completion.output?.[0]?.content?.[0]?.text ??              // Fallback: first text
        completion.output_text ??                                  // Legacy location
        completion.choices?.[0]?.message?.content ??               // Chat completions format
        'No response'

      // If response is a JSON string, parse it
      if (typeof rawResponse === 'string') {
        try {
          response = JSON.parse(rawResponse)
        } catch {
          response = rawResponse
        }
      } else {
        response = rawResponse
      }

      tokensUsed = completion.usage?.total_tokens
    } else if (provider === 'claude') {
      // Claude API call - send the exact JSON
      const completion = await anthropic.messages.create(processedJson)

      // Store the full API response for debugging
      fullApiResponse = completion

      // Extract text from Claude response
      const textContent = completion.content.find(c => c.type === 'text')
      response = textContent && 'text' in textContent ? textContent.text : 'No response'
      tokensUsed = completion.usage?.input_tokens + completion.usage?.output_tokens
    } else {
      return NextResponse.json(
        { error: 'Invalid provider. Must be "openai" or "claude"' },
        { status: 400 }
      )
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      response,
      tokensUsed,
      duration,
      provider,
      model: processedJson.model || 'unknown',
      apiRequest, // Return the exact API request object
      fullApiResponse, // Return full API response for debugging
    })
  } catch (error) {
    console.error('[AI Test] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to test prompt',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
