import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AI_PROMPTS } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { promptType } = body

    if (!promptType) {
      return NextResponse.json(
        { error: 'Missing required field: promptType' },
        { status: 400 }
      )
    }

    let templatePrompt = ''

    try {
      // Load templates with placeholders (don't inject actual data)
      // Placeholders: {{title}}, {{description}}, {{content}}, {{headline}}, {{url}}

      if (promptType === 'article-title') {
        templatePrompt = await AI_PROMPTS.primaryArticleTitle({
          title: '{{title}}',
          description: '{{description}}',
          content: '{{content}}'
        })
      } else if (promptType === 'article-body') {
        templatePrompt = await AI_PROMPTS.primaryArticleBody({
          title: '{{title}}',
          description: '{{description}}',
          content: '{{content}}',
          source_url: '{{url}}'
        }, '{{headline}}')
      } else if (promptType === 'post-scorer') {
        templatePrompt = await AI_PROMPTS.criteria1Evaluator({
          title: '{{title}}',
          description: '{{description}}',
          content: '{{content}}'
        })
      } else if (promptType === 'subject-line') {
        templatePrompt = await AI_PROMPTS.subjectLineGenerator({
          headline: '{{headline}}',
          content: '{{content}}'
        })
      } else {
        return NextResponse.json(
          { error: 'Invalid prompt type' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        prompt: templatePrompt
      })
    } catch (error) {
      console.error('[API] Error generating prompt template:', error)
      return NextResponse.json(
        { error: 'Failed to generate prompt template' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API] Error in load-prompt-template:', error)
    return NextResponse.json(
      {
        error: 'Failed to load prompt template',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
