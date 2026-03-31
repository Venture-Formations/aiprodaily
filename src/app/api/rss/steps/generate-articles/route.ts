import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { RSSProcessor } from '@/lib/rss-processor'
import { supabaseAdmin } from '@/lib/supabase'
import { startWorkflowStep, completeWorkflowStep, failWorkflow } from '@/lib/workflow-state'

/**
 * Step 5: Generate newsletter articles (title + body + fact check)
 * Processes both primary and secondary sections
 */
export const POST = withApiHandler(
  { authTier: 'system', logContext: 'rss/steps/generate-articles' },
  async ({ request }) => {
    let issue_id: string | undefined

    try {
      const body = await request.json()
      issue_id = body.issue_id

      if (!issue_id) {
        return NextResponse.json({ error: 'issue_id is required' }, { status: 400 })
      }

      const startResult = await startWorkflowStep(issue_id, 'pending_generate')
      if (!startResult.success) {
        return NextResponse.json({
          success: false,
          message: startResult.message,
          step: '5/7'
        }, { status: 409 })
      }

      const processor = new RSSProcessor()

      // Generate primary articles
      console.log('Generating primary newsletter articles...')
      await processor.generateArticlesForSection(issue_id, 'primary')

      // Generate secondary articles
      await processor.generateArticlesForSection(issue_id, 'secondary')

      // Count generated articles
      const { data: moduleArticles } = await supabaseAdmin
        .from('module_articles')
        .select('id, fact_check_score')
        .eq('issue_id', issue_id)

      const totalArticles = moduleArticles?.length || 0

      // Count articles that passed fact checking
      const totalPassed = moduleArticles?.filter(a => a.fact_check_score >= 70).length || 0

      await completeWorkflowStep(issue_id, 'generating')

      return NextResponse.json({
        success: true,
        message: 'Generate articles step completed',
        issue_id,
        total_articles: totalArticles,
        fact_check_passed: totalPassed,
        next_state: 'pending_finalize',
        step: '5/7'
      })

    } catch (error) {
      console.error('[Step 5] Generate articles failed:', error)

      if (issue_id) {
        await failWorkflow(
          issue_id,
          `Generate articles step failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      return NextResponse.json({
        error: 'Generate articles step failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        step: '5/7'
      }, { status: 500 })
    }
  }
)
