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
    const { promptType, post } = body

    if (!promptType || !post) {
      return NextResponse.json(
        { error: 'Missing required fields: promptType, post' },
        { status: 400 }
      )
    }

    let templatePrompt = ''

    try {
      if (promptType === 'article-generator') {
        templatePrompt = await AI_PROMPTS.primaryArticleTitle({
          title: post.title,
          description: post.description || '',
          content: post.full_article_text || ''
        })
      } else if (promptType === 'post-scorer') {
        templatePrompt = await AI_PROMPTS.criteria1Evaluator({
          title: post.title,
          description: post.description || '',
          content: post.full_article_text || ''
        })
      } else if (promptType === 'subject-line') {
        templatePrompt = await AI_PROMPTS.subjectLineGenerator({
          headline: post.title,
          content: post.description || post.full_article_text?.substring(0, 200) || ''
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
