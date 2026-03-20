import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-handler';
import { supabaseAdmin } from '@/lib/supabase';

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'databases-stats', requirePublicationId: true },
  async ({ publicationId }) => {
    // All counts filtered by publication_id
    const [
      { count: aiAppsCount, error: aiAppsError },
      { count: promptsCount, error: promptsError },
      { count: adsCount, error: adsError },
      { count: pollsCount, error: pollsError },
      { count: manualArticlesCount, error: manualArticlesError },
      { count: articleImagesCount, error: articleImagesError },
    ] = await Promise.all([
      supabaseAdmin.from('ai_applications').select('id', { count: 'exact', head: true }).eq('publication_id', publicationId!),
      supabaseAdmin.from('prompt_ideas').select('id', { count: 'exact', head: true }).eq('publication_id', publicationId!),
      supabaseAdmin.from('advertisements').select('id', { count: 'exact', head: true }).eq('publication_id', publicationId!),
      supabaseAdmin.from('polls').select('id', { count: 'exact', head: true }).eq('publication_id', publicationId!),
      supabaseAdmin.from('manual_articles').select('id', { count: 'exact', head: true }).eq('publication_id', publicationId!),
      supabaseAdmin.from('article_images').select('id', { count: 'exact', head: true }).eq('publication_id', publicationId!),
    ])

    if (aiAppsError) console.error('[DB] Error fetching AI applications count:', aiAppsError.message)
    if (promptsError) console.error('[DB] Error fetching prompt ideas count:', promptsError.message)
    if (adsError) console.error('[DB] Error fetching Ads count:', adsError.message)
    if (pollsError) console.error('[DB] Error fetching polls count:', pollsError.message)
    if (manualArticlesError) console.error('[DB] Error fetching manual articles count:', manualArticlesError.message)
    if (articleImagesError) console.error('[DB] Error fetching article images count:', articleImagesError.message)

    const databases = [
      {
        name: 'AI Applications',
        description: 'AI tools and applications featured in the newsletter',
        count: aiAppsCount || 0,
        href: '/dashboard/databases/ai-apps'
      },
      {
        name: 'Prompt Ideas',
        description: 'AI prompts and templates for the newsletter',
        count: promptsCount || 0,
        href: '/dashboard/databases/prompt-ideas'
      },
      {
        name: 'Advertisements',
        description: 'Newsletter advertisement submissions',
        count: adsCount || 0,
        href: '/dashboard/databases/ads'
      },
      {
        name: 'Polls',
        description: 'Newsletter polls for subscriber engagement',
        count: pollsCount || 0,
        href: '/dashboard/polls'
      },
      {
        name: 'Manual Articles',
        description: 'Custom articles for newsletters and /news pages',
        count: manualArticlesCount || 0,
        href: '/dashboard/databases/manual-articles'
      },
      {
        name: 'Trade Images',
        description: 'Member + transaction images for article modules',
        count: articleImagesCount || 0,
        href: '/dashboard/article-images'
      }
    ];

    return NextResponse.json({ databases });
  }
);
