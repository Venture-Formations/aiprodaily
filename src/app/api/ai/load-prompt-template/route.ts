import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AI_PROMPTS } from '@/lib/openai'
import { supabaseAdmin } from '@/lib/supabase'

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

    // Check if this is a module-based prompt type (e.g., "module-{uuid}-title" or "module-{uuid}-body")
    const moduleMatch = promptType.match(/^module-(.+)-(title|body)$/)

    if (moduleMatch) {
      // Handle module-based prompts from article_module_prompts table
      const moduleId = moduleMatch[1]
      const promptCategory = moduleMatch[2] // 'title' or 'body'
      const modulePromptType = promptCategory === 'title' ? 'article_title' : 'article_body'

      const { data: modulePrompt, error: moduleError } = await supabaseAdmin
        .from('article_module_prompts')
        .select('ai_prompt')
        .eq('article_module_id', moduleId)
        .eq('prompt_type', modulePromptType)
        .maybeSingle()

      if (moduleError) {
        console.error('[API] Error loading module prompt template:', moduleError)
        return NextResponse.json(
          { error: 'Failed to load module prompt', details: moduleError.message },
          { status: 500 }
        )
      }

      if (!modulePrompt) {
        return NextResponse.json({
          success: true,
          prompt: '' // Return empty if no prompt found
        })
      }

      return NextResponse.json({
        success: true,
        prompt: modulePrompt.ai_prompt
      })
    }

    let templatePrompt = ''

    try {
      // Load templates with placeholders (don't inject actual data)
      // Placeholders: {{title}}, {{description}}, {{content}}, {{headline}}, {{url}}

      if (promptType === 'primary-title') {
        templatePrompt = await AI_PROMPTS.primaryArticleTitle({
          title: '{{title}}',
          description: '{{description}}',
          content: '{{content}}'
        })
      } else if (promptType === 'primary-body') {
        templatePrompt = await AI_PROMPTS.primaryArticleBody({
          title: '{{title}}',
          description: '{{description}}',
          content: '{{content}}',
          source_url: '{{url}}'
        }, '{{headline}}')
      } else if (promptType === 'secondary-title') {
        templatePrompt = await AI_PROMPTS.secondaryArticleTitle({
          title: '{{title}}',
          description: '{{description}}',
          content: '{{content}}'
        })
      } else if (promptType === 'secondary-body') {
        templatePrompt = await AI_PROMPTS.secondaryArticleBody({
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
