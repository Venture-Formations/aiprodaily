import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 5: Generate Headlines/Bodies
 * - Generate newsletter article headlines and bodies from scored posts
 */
export async function executeStep5(campaignId: string) {
  const processor = new RSSProcessor()

  // Generate articles for both sections
  await processor.generateArticlesForSection(campaignId, 'primary')
  await processor.generateArticlesForSection(campaignId, 'secondary')

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id')
    .eq('campaign_id', campaignId)

  const { data: secondaryArticles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id')
    .eq('campaign_id', campaignId)

  const articlesCount = articles ? articles.length : 0
  const secondaryCount = secondaryArticles ? secondaryArticles.length : 0
  
  // Log batch stats if available from processor
  console.log(`[Step 5/8] Complete: ${articlesCount} primary articles, ${secondaryCount} secondary articles`)
  return { articlesCount, secondaryCount }
}

