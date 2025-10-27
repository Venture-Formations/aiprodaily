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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      provider,
      model,
      prompt,
      temperature,
      maxTokens,
      topP,
      presencePenalty,
      frequencyPenalty,
      post
    } = body

    if (!provider || !model || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, model, prompt' },
        { status: 400 }
      )
    }

    // Inject post data into placeholders
    let processedPrompt = prompt
    if (post) {
      processedPrompt = prompt
        .replace(/\{\{title\}\}/g, post.title || '')
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.full_article_text || 'No content available')
        .replace(/\{\{headline\}\}/g, post.title || '') // Use title as headline for testing
        .replace(/\{\{url\}\}/g, post.source_url || '')
    }

    const startTime = Date.now()
    let response: string
    let tokensUsed: number | undefined

    if (provider === 'openai') {
      // OpenAI API call
      const requestParams: any = {
        model,
        messages: [{ role: 'user', content: processedPrompt }],
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 1000,
      }

      // Add optional parameters if provided
      if (topP !== undefined && topP !== 1.0) requestParams.top_p = topP
      if (presencePenalty !== undefined && presencePenalty !== 0) requestParams.presence_penalty = presencePenalty
      if (frequencyPenalty !== undefined && frequencyPenalty !== 0) requestParams.frequency_penalty = frequencyPenalty

      const completion = await openai.chat.completions.create(requestParams)

      response = completion.choices[0]?.message?.content || 'No response'
      tokensUsed = completion.usage?.total_tokens
    } else if (provider === 'claude') {
      // Claude API call - Note: Claude doesn't support top_p, presence_penalty, or frequency_penalty
      const completion = await anthropic.messages.create({
        model,
        max_tokens: maxTokens ?? 1000,
        temperature: temperature ?? 0.7,
        messages: [{ role: 'user', content: processedPrompt }],
      })

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
      model,
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
