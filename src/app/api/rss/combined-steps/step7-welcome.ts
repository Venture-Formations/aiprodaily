import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 7: Generate Welcome Section
 * - Generate welcome message based on top articles
 */
export async function executeStep7(campaignId: string) {
  const processor = new RSSProcessor()

  await processor.generateWelcomeSection(campaignId)

  console.log(`[Step 7/8] Complete: Welcome section generated`)
  return { welcomeGenerated: true }
}

