import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const maxDuration = 60

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, promptJson, post } = body

    if (!provider || !promptJson) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, promptJson' },
        { status: 400 }
      )
    }

    // Inject post data into the entire JSON request
    const processedJson = injectPostData(promptJson, post)

    const startTime = Date.now()
    let response: string
    let tokensUsed: number | undefined
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

      response =
        completion.output?.[0]?.content?.[0]?.json ??
        completion.output?.[0]?.content?.[0]?.input_json ??
        completion.output?.[0]?.content?.[0]?.text ??
        completion.output_text ??
        'No response'
      tokensUsed = completion.usage?.total_tokens
    } else if (provider === 'claude') {
      // Claude API call - send the exact JSON
      const completion = await anthropic.messages.create(processedJson)

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
