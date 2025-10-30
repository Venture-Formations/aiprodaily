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

    // Get scoring criteria settings
    const { data: criteriaSettings } = await supabase
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

    const criteriaConfig: Record<string, string> = {};
    criteriaSettings?.forEach(setting => {
      criteriaConfig[setting.key] = setting.value;
    });

    // First, get campaigns for this newsletter
    const { data: campaigns } = await supabase
      .from('newsletter_campaigns')
      .select('id, date, newsletter_id')
      .eq('newsletter_id', newsletterId);

    if (!campaigns || campaigns.length === 0) {
      console.log('[API] No campaigns found for newsletter:', newsletterId);
      return NextResponse.json({ data: [] });
    }

    const campaignIds = campaigns.map(c => c.id);
    const campaignMap = new Map(campaigns.map(c => [c.id, c]));

    console.log('[API] Found campaigns:', campaignIds.length);

    // Fetch primary articles for these campaigns
    const { data: primaryArticles, error: primaryError } = await supabase
      .from('articles')
      .select(`
        id,
        post_id,
        campaign_id,
        headline,
        content,
        rank,
        fact_check_score,
        word_count,
        created_at
      `)
      .in('campaign_id', campaignIds);

    if (primaryError) {
      console.error('[API] Primary articles error:', primaryError.message);
      throw primaryError;
    }

    console.log('[API] Found primary articles:', primaryArticles?.length || 0);

    // Fetch secondary articles for these campaigns
    const { data: secondaryArticles, error: secondaryError } = await supabase
      .from('secondary_articles')
      .select(`
        id,
        post_id,
        campaign_id,
        headline,
        content,
        rank,
        fact_check_score,
        word_count,
        created_at
      `)
      .in('campaign_id', campaignIds);

    if (secondaryError) {
      console.error('[API] Secondary articles error:', secondaryError.message);
      throw secondaryError;
    }

    console.log('[API] Found secondary articles:', secondaryArticles?.length || 0);

    // Get all post IDs
    const allPostIds = [
      ...(primaryArticles || []).map(a => a.post_id),
      ...(secondaryArticles || []).map(a => a.post_id)
    ].filter((id, index, self) => id && self.indexOf(id) === index); // Filter out null/undefined

    console.log('[API] Post IDs to fetch:', allPostIds.length, 'IDs:', allPostIds.slice(0, 5));

    // Fetch RSS posts (only if we have post IDs)
    let rssPosts: any[] = [];
    if (allPostIds.length > 0) {
      const { data, error: rssPostsError } = await supabase
        .from('rss_posts')
        .select(`
          id,
          feed_id,
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
          final_priority_score
        `)
        .in('id', allPostIds);

      if (rssPostsError) {
        console.error('[API] RSS posts error:', rssPostsError.message);
      }
      rssPosts = data || [];
    }

    console.log('[API] Found RSS posts:', rssPosts?.length || 0);

    const postMap = new Map(rssPosts?.map(p => [p.id, p]) || []);

    // Get all feed IDs
    const allFeedIds = (rssPosts || [])
      .map(p => p.feed_id)
      .filter((id, index, self) => id && self.indexOf(id) === index);

    // Fetch RSS feeds (only if we have feed IDs)
    let rssFeeds: any[] = [];
    if (allFeedIds.length > 0) {
      const { data } = await supabase
        .from('rss_feeds')
        .select('id, name, use_for_primary_section, use_for_secondary_section')
        .in('id', allFeedIds);
      rssFeeds = data || [];
    }

    const feedMap = new Map(rssFeeds?.map(f => [f.id, f]) || []);

    // Transform and combine articles
    const transformArticle = (article: any, isPrimary: boolean) => {
      const post = postMap.get(article.post_id);
      const campaign = campaignMap.get(article.campaign_id);
      const feed = post ? feedMap.get(post.feed_id) : null;

      // Skip if no campaign (required for date)
      if (!campaign) return null;

      // If no post data, we'll show what we have from the article table

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
        feedName: feed?.name || 'Unknown',

        criteria1Score: post.criteria_1_score || null,
        criteria1Weight: parseFloat(criteriaConfig.scoring_criteria_1_weight || '0'),
        criteria1Reasoning: post.criteria_1_reason || '',
        criteria1Name: criteriaConfig.scoring_criteria_1_name || 'Criteria 1',
        criteria1Enabled: criteriaConfig.scoring_criteria_1_enabled === 'true',

        criteria2Score: post.criteria_2_score || null,
        criteria2Weight: parseFloat(criteriaConfig.scoring_criteria_2_weight || '0'),
        criteria2Reasoning: post.criteria_2_reason || '',
        criteria2Name: criteriaConfig.scoring_criteria_2_name || 'Criteria 2',
        criteria2Enabled: criteriaConfig.scoring_criteria_2_enabled === 'true',

        criteria3Score: post.criteria_3_score || null,
        criteria3Weight: parseFloat(criteriaConfig.scoring_criteria_3_weight || '0'),
        criteria3Reasoning: post.criteria_3_reason || '',
        criteria3Name: criteriaConfig.scoring_criteria_3_name || 'Criteria 3',
        criteria3Enabled: criteriaConfig.scoring_criteria_3_enabled === 'true',

        criteria4Score: post.criteria_4_score || null,
        criteria4Weight: parseFloat(criteriaConfig.scoring_criteria_4_weight || '0'),
        criteria4Reasoning: post.criteria_4_reason || '',
        criteria4Name: criteriaConfig.scoring_criteria_4_name || 'Criteria 4',
        criteria4Enabled: criteriaConfig.scoring_criteria_4_enabled === 'true',

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
        campaignDate: campaign.date || ''
      };
    };

    const allArticles = [
      ...(primaryArticles || []).map(a => transformArticle(a, true)),
      ...(secondaryArticles || []).map(a => transformArticle(a, false))
    ].filter(a => a !== null);

    // Sort by campaign date (most recent first), then by final position
    allArticles.sort((a, b) => {
      const dateCompare = (b?.campaignDate || '').localeCompare(a?.campaignDate || '');
      if (dateCompare !== 0) return dateCompare;

      const posA = a?.finalPosition || 999;
      const posB = b?.finalPosition || 999;
      return posA - posB;
    });

    console.log(`[API] Articles fetched: ${allArticles.length} total`);

    return NextResponse.json({ data: allArticles });

  } catch (error: any) {
    console.error('[API] Articles fetch error:', error.message);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
