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

    // Polls count
    const { data: pollsCount, error: pollsError } = await supabase
      .from('polls')
      .select('id', { count: 'exact' });

    if (pollsError) {
      console.error('[API] Error fetching polls count:', pollsError.message);
    }

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
        name: 'Polls',
        description: 'Newsletter polls for subscriber engagement',
        count: pollsCount?.length || 0,
        href: '/dashboard/polls'
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
