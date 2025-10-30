import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const newsletterId = searchParams.get('newsletter_id');

    if (!newsletterId) {
      return NextResponse.json(
        { error: 'newsletter_id is required' },
        { status: 400 }
      );
    }

    // Fetch primary articles with related data
    const { data: primaryArticles, error: primaryError } = await supabase
      .from('articles')
      .select(`
        id,
        headline,
        content,
        rank,
        fact_check_score,
        word_count,
        created_at,
        rss_posts!inner (
          id,
          title,
          description,
          full_article_text,
          published_date,
          author,
          source_url,
          image_url,
          criteria_1_score,
          criteria_1_reason,
          criteria_2_score,
          criteria_2_reason,
          criteria_3_score,
          criteria_3_reason,
          criteria_4_score,
          criteria_4_reason,
          criteria_5_score,
          criteria_5_reason,
          final_priority_score,
          rss_feeds!inner (
            id,
            name,
            use_for_primary_section
          )
        ),
        newsletter_campaigns!inner (
          newsletter_id,
          date
        )
      `)
      .eq('newsletter_campaigns.newsletter_id', newsletterId);

    if (primaryError) {
      console.error('[API] Primary articles query failed:', primaryError.message);
      throw primaryError;
    }

    // Fetch secondary articles with related data
    const { data: secondaryArticles, error: secondaryError } = await supabase
      .from('secondary_articles')
      .select(`
        id,
        headline,
        content,
        rank,
        fact_check_score,
        word_count,
        created_at,
        rss_posts!inner (
          id,
          title,
          description,
          full_article_text,
          published_date,
          author,
          source_url,
          image_url,
          criteria_1_score,
          criteria_1_reason,
          criteria_2_score,
          criteria_2_reason,
          criteria_3_score,
          criteria_3_reason,
          criteria_4_score,
          criteria_4_reason,
          criteria_5_score,
          criteria_5_reason,
          final_priority_score,
          rss_feeds!inner (
            id,
            name,
            use_for_primary_section,
            use_for_secondary_section
          )
        ),
        newsletter_campaigns!inner (
          newsletter_id,
          date
        )
      `)
      .eq('newsletter_campaigns.newsletter_id', newsletterId);

    if (secondaryError) {
      console.error('[API] Secondary articles query failed:', secondaryError.message);
      throw secondaryError;
    }

    // Get scoring criteria weights and names
    const { data: criteriaSettings, error: criteriaError } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('newsletter_id', newsletterId)
      .in('key', [
        'scoring_criteria_1_name',
        'scoring_criteria_1_weight',
        'scoring_criteria_2_name',
        'scoring_criteria_2_weight',
        'scoring_criteria_3_name',
        'scoring_criteria_3_weight',
        'scoring_criteria_4_name',
        'scoring_criteria_4_weight',
        'scoring_criteria_5_name',
        'scoring_criteria_5_weight',
        'scoring_criteria_1_enabled',
        'scoring_criteria_2_enabled',
        'scoring_criteria_3_enabled',
        'scoring_criteria_4_enabled',
        'scoring_criteria_5_enabled'
      ]);

    if (criteriaError) {
      console.error('[API] Criteria settings query failed:', criteriaError.message);
    }

    // Parse criteria settings
    const criteriaConfig: Record<string, string> = {};
    criteriaSettings?.forEach(setting => {
      criteriaConfig[setting.key] = setting.value;
    });

    // Transform and combine articles
    const transformArticle = (article: any, isPrimary: boolean) => {
      const post = article.rss_posts;
      const feed = post.rss_feeds;

      return {
        id: article.id,
        originalTitle: post.title || '',
        originalDescription: post.description || '',
        originalFullText: post.full_article_text || '',
        publicationDate: post.published_date || '',
        author: post.author || '',
        sourceUrl: post.source_url || '',
        imageUrl: post.image_url || '',
        feedType: isPrimary ? 'Primary' : 'Secondary',
        feedName: feed.name || '',

        // Criteria 1
        criteria1Score: post.criteria_1_score || null,
        criteria1Weight: parseFloat(criteriaConfig.scoring_criteria_1_weight || '0'),
        criteria1Reasoning: post.criteria_1_reason || '',
        criteria1Name: criteriaConfig.scoring_criteria_1_name || 'Criteria 1',
        criteria1Enabled: criteriaConfig.scoring_criteria_1_enabled === 'true',

        // Criteria 2
        criteria2Score: post.criteria_2_score || null,
        criteria2Weight: parseFloat(criteriaConfig.scoring_criteria_2_weight || '0'),
        criteria2Reasoning: post.criteria_2_reason || '',
        criteria2Name: criteriaConfig.scoring_criteria_2_name || 'Criteria 2',
        criteria2Enabled: criteriaConfig.scoring_criteria_2_enabled === 'true',

        // Criteria 3
        criteria3Score: post.criteria_3_score || null,
        criteria3Weight: parseFloat(criteriaConfig.scoring_criteria_3_weight || '0'),
        criteria3Reasoning: post.criteria_3_reason || '',
        criteria3Name: criteriaConfig.scoring_criteria_3_name || 'Criteria 3',
        criteria3Enabled: criteriaConfig.scoring_criteria_3_enabled === 'true',

        // Criteria 4
        criteria4Score: post.criteria_4_score || null,
        criteria4Weight: parseFloat(criteriaConfig.scoring_criteria_4_weight || '0'),
        criteria4Reasoning: post.criteria_4_reason || '',
        criteria4Name: criteriaConfig.scoring_criteria_4_name || 'Criteria 4',
        criteria4Enabled: criteriaConfig.scoring_criteria_4_enabled === 'true',

        // Criteria 5
        criteria5Score: post.criteria_5_score || null,
        criteria5Weight: parseFloat(criteriaConfig.scoring_criteria_5_weight || '0'),
        criteria5Reasoning: post.criteria_5_reason || '',
        criteria5Name: criteriaConfig.scoring_criteria_5_name || 'Criteria 5',
        criteria5Enabled: criteriaConfig.scoring_criteria_5_enabled === 'true',

        totalScore: post.final_priority_score || null,
        headline: article.headline || '',
        content: article.content || '',
        factCheckScore: article.fact_check_score || null,
        wordCount: article.word_count || null,
        finalPosition: article.rank || null,
        createdAt: article.created_at || '',
        campaignDate: article.newsletter_campaigns?.date || ''
      };
    };

    const allArticles = [
      ...(primaryArticles || []).map(a => transformArticle(a, true)),
      ...(secondaryArticles || []).map(a => transformArticle(a, false))
    ];

    // Sort by campaign date (most recent first), then by final position
    allArticles.sort((a, b) => {
      const dateCompare = b.campaignDate.localeCompare(a.campaignDate);
      if (dateCompare !== 0) return dateCompare;

      const posA = a.finalPosition || 999;
      const posB = b.finalPosition || 999;
      return posA - posB;
    });

    console.log(`[API] Articles fetched: ${allArticles.length} total (${primaryArticles?.length || 0} primary, ${secondaryArticles?.length || 0} secondary)`);

    return NextResponse.json({ data: allArticles });

  } catch (error: any) {
    console.error('[API] Articles fetch error:', error.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
