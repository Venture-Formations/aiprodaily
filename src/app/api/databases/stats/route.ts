import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // AI Applications count
    const { data: aiAppsCount, error: aiAppsError } = await supabase
      .from('ai_applications')
      .select('id', { count: 'exact' });

    if (aiAppsError) {
      console.error('[API] Error fetching AI applications count:', aiAppsError.message);
    }

    // Prompt Ideas count
    const { data: promptsCount, error: promptsError } = await supabase
      .from('prompt_ideas')
      .select('id', { count: 'exact' });

    if (promptsError) {
      console.error('[API] Error fetching prompt ideas count:', promptsError.message);
    }

    // Advertisements count
    const { data: adsCount, error: adsError } = await supabase
      .from('advertisements')
      .select('id', { count: 'exact' });

    if (adsError) {
      console.error('[API] Error fetching Ads count:', adsError.message);
    }

    // Articles count (both primary and secondary)
    const { data: articlesCount, error: articlesError } = await supabase
      .from('articles')
      .select('id', { count: 'exact' });

    if (articlesError) {
      console.error('[API] Error fetching articles count:', articlesError.message);
    }

    const { data: secondaryArticlesCount, error: secondaryArticlesError } = await supabase
      .from('secondary_articles')
      .select('id', { count: 'exact' });

    if (secondaryArticlesError) {
      console.error('[API] Error fetching secondary articles count:', secondaryArticlesError.message);
    }

    const totalArticlesCount = (articlesCount?.length || 0) + (secondaryArticlesCount?.length || 0);

    const databases = [
      {
        name: 'AI Applications',
        description: 'AI tools and applications for accountants',
        count: aiAppsCount?.length || 0,
        href: '/dashboard/databases/ai-apps'
      },
      {
        name: 'Prompt Ideas',
        description: 'AI prompts and templates for accounting tasks',
        count: promptsCount?.length || 0,
        href: '/dashboard/databases/prompt-ideas'
      },
      {
        name: 'Advertisements',
        description: 'Newsletter advertisement submissions',
        count: adsCount?.length || 0,
        href: '/dashboard/databases/ads'
      },
      {
        name: 'Articles',
        description: 'Current and past newsletter articles with scoring details',
        count: totalArticlesCount,
        href: '/dashboard/databases/articles'
      }
    ];

    return NextResponse.json({ databases });
  } catch (error: any) {
    console.error('[API] Database stats error:', error.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
