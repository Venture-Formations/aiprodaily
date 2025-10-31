import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'

/**
 * Step 8: Finalize
 * - Mark campaign as draft
 * - Send completion notifications
 */
export async function executeStep8(campaignId: string) {
  // Update campaign status
  await supabaseAdmin
    .from('newsletter_campaigns')
    .update({ status: 'draft' })
    .eq('id', campaignId)

  // Get article count
  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id')
    .eq('campaign_id', campaignId)

  const articleCount = articles ? articles.length : 0

  // Get campaign date
  const { data: campaign } = await supabaseAdmin
    .from('newsletter_campaigns')
    .select('date')
    .eq('id', campaignId)
    .single()

  const campaignDate = campaign ? campaign.date : 'Unknown'

  // Send Slack notification
  try {
    const slack = new SlackNotificationService()
    await slack.sendRSSProcessingCompleteAlert(campaignId, articleCount, campaignDate)
  } catch (error) {
    // Don't fail if Slack fails
  }

  console.log(`[Step 8/8] Complete: ${articleCount} articles, marked as draft`)
  return { articleCount, campaignDate }
}

