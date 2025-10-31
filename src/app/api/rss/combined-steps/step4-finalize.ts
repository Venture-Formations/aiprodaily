import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Combined Step 4: Finalize
 * - Generate welcome section
 * - Update campaign status to draft
 * - Send completion notifications
 */
export async function executeStep4(campaignId: string) {

  // Generate welcome section (after articles are ready)
  const processor = new RSSProcessor()
  await processor.generateWelcomeSection(campaignId)

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

  console.log(`[Step 4/4] Complete: ${articleCount} articles`)
  return { articleCount, campaignDate }
}
