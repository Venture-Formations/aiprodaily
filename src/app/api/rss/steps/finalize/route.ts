import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { ErrorHandler, SlackNotificationService } from '@/lib/slack'
import { startWorkflowStep, completeWorkflowStep, failWorkflow } from '@/lib/workflow-state'
import { AdScheduler } from '@/lib/ad-scheduler'

/**
 * Step 6: Finalize issue
 * Updates issue status to draft and sends Slack notifications
 */
export const POST = withApiHandler(
  { authTier: 'system', logContext: 'rss/steps/finalize' },
  async ({ request }) => {
    let issue_id: string | undefined

    try {
      const body = await request.json()
      issue_id = body.issue_id

      if (!issue_id) {
        return NextResponse.json({ error: 'issue_id is required' }, { status: 400 })
      }

      const startResult = await startWorkflowStep(issue_id, 'pending_finalize')
      if (!startResult.success) {
        return NextResponse.json({
          success: false,
          message: startResult.message,
          step: '7/7'
        }, { status: 409 })
      }

      const errorHandler = new ErrorHandler()
      const slack = new SlackNotificationService()

      // Update issue status from processing to draft
      await supabaseAdmin
        .from('publication_issues')
        .update({ status: 'draft' })
        .eq('id', issue_id)

      console.log('issue status updated to draft')

      // Select and assign advertisement for this issue
      try {
        const { data: issueData } = await supabaseAdmin
          .from('publication_issues')
          .select('date, publication_id')
          .eq('id', issue_id)
          .single()

        if (issueData) {
          const selectedAd = await AdScheduler.selectAdForissue({
            issueId: issue_id,
            issueDate: issueData.date,
            newsletterId: issueData.publication_id
          })

          if (selectedAd) {
            // Check if ad already assigned to prevent duplicates
            const { data: existingAssignment } = await supabaseAdmin
              .from('issue_advertisements')
              .select('id')
              .eq('issue_id', issue_id)
              .single()

            if (!existingAssignment) {
              // Store the selected ad (usage will be recorded at send-final via AdScheduler.recordAdUsage)
              await supabaseAdmin
                .from('issue_advertisements')
                .insert({
                  issue_id: issue_id,
                  advertisement_id: selectedAd.id,
                  issue_date: issueData.date
                  // Note: used_at is NOT set here - it will be set at send-final time
                })

              console.log(`[Finalize] Selected ad: ${selectedAd.title} (ID: ${selectedAd.id})`)
            } else {
              console.log('[Finalize] Ad already assigned to this issue')
            }
          } else {
            console.log('[Finalize] No active ads available for this issue')
          }
        }
      } catch (adError) {
        console.error('[Finalize] Error selecting ad:', adError)
        // Don't fail the entire step if ad selection fails
      }

      // Get final article count to report to Slack
      const { data: finalArticles } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('issue_id', issue_id)

      const articleCount = finalArticles?.length || 0

      // Get issue date for notifications
      const { data: issueInfo } = await supabaseAdmin
        .from('publication_issues')
        .select('date')
        .eq('id', issue_id)
        .maybeSingle()

      const issueDate = issueInfo?.date || 'Unknown'

      await errorHandler.logInfo('RSS processing completed successfully', {
        issueId: issue_id,
        articleCount,
        issueDate
      }, 'rss_step_finalize')

      // Send Slack notification
      try {
        await slack.sendRSSProcessingCompleteAlert(
          issue_id,
          articleCount,
          issueDate
        )
      } catch (slackError) {
        console.error('Failed to send Slack notification:', slackError)
        // Don't fail the entire step if Slack fails
      }

      await completeWorkflowStep(issue_id, 'finalizing')

      return NextResponse.json({
        success: true,
        message: 'RSS processing workflow complete!',
        issue_id,
        article_count: articleCount,
        issue_date: issueDate,
        status: 'draft',
        workflow_state: 'complete',
        step: '7/7'
      })

    } catch (error) {
      console.error('[Step 7] Finalize failed:', error)

      if (issue_id) {
        await failWorkflow(
          issue_id,
          `Finalize step failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      return NextResponse.json({
        error: 'Finalize step failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        step: '7/7'
      }, { status: 500 })
    }
  }
)
