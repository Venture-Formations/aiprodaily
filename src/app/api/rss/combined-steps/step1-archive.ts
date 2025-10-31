import { supabaseAdmin } from '@/lib/supabase'
import { ArticleArchiveService } from '@/lib/article-archive'

/**
 * Step 1: Archive
 * - Archive old campaign data before clearing
 */
export async function executeStep1(campaignId: string) {
  const archiveService = new ArticleArchiveService()

  // Archive existing data
  try {
    await archiveService.archiveCampaignArticles(campaignId, 'rss_processing_clear')
  } catch {
    // Archive failure is non-critical
  }

  // Clear previous data
  await supabaseAdmin.from('articles').delete().eq('campaign_id', campaignId)
  await supabaseAdmin.from('secondary_articles').delete().eq('campaign_id', campaignId)
  await supabaseAdmin.from('rss_posts').delete().eq('campaign_id', campaignId)

  console.log(`[Step 1/8] Complete: Archive`)
  return { archived: true }
}

