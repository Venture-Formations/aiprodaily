import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const newsletterSlug = searchParams.get('newsletter_id'); // Actually a slug, not UUID

    if (!newsletterSlug) {
      return NextResponse.json(
        { error: 'newsletter_id is required' },
        { status: 400 }
      );
    }

    // Convert slug to UUID (required for database queries)
    const { data: newsletter, error: newsletterError } = await supabase
      .from('newsletters')
      .select('id')
      .eq('slug', newsletterSlug)
      .single();

    if (newsletterError || !newsletter) {
      console.error('[API] Newsletter not found:', newsletterSlug);
      return NextResponse.json(
        { error: 'Newsletter not found' },
        { status: 404 }
      );
    }

    const newsletterId = newsletter.id;
    console.log('[API] Newsletter:', newsletterSlug, '→ UUID:', newsletterId);

    // Get scoring criteria settings
    const { data: criteriaSettings } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('newsletter_id', newsletterId)
      .in('key', [
        'criteria_1_name',
        'criteria_1_weight',
        'criteria_2_name',
        'criteria_2_weight',
        'criteria_3_name',
        'criteria_3_weight',
        'criteria_4_name',
        'criteria_4_weight',
        'criteria_5_name',
        'criteria_5_weight',
        'criteria_enabled_count'
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

    console.log('[API] Found campaigns:', campaigns?.length || 0);

    const campaignIds = (campaigns || []).map(c => c.id);
    const campaignMap = new Map((campaigns || []).map(c => [c.id, c]));

    // Fetch primary articles - if we have campaigns, filter by them, otherwise get all
    let primaryQuery = supabase
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
      `);

    if (campaignIds.length > 0) {
      primaryQuery = primaryQuery.in('campaign_id', campaignIds);
    }

    const { data: primaryArticles, error: primaryError } = await primaryQuery;

    if (primaryError) {
      console.error('[API] Primary articles error:', primaryError.message);
      throw primaryError;
    }

    console.log('[API] Found primary articles:', primaryArticles?.length || 0);
    if (primaryArticles && primaryArticles.length > 0) {
      console.log('[API] Sample primary article:', { id: primaryArticles[0].id, post_id: primaryArticles[0].post_id, campaign_id: primaryArticles[0].campaign_id });
    }

    // Fetch secondary articles - if we have campaigns, filter by them, otherwise get all
    let secondaryQuery = supabase
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
      `);

    if (campaignIds.length > 0) {
      secondaryQuery = secondaryQuery.in('campaign_id', campaignIds);
    }

    const { data: secondaryArticles, error: secondaryError } = await secondaryQuery;

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
          publication_date,
          author,
          source_url,
          image_url
        `)
        .in('id', allPostIds);

      if (rssPostsError) {
        console.error('[API] RSS posts error:', rssPostsError.message);
      }
      rssPosts = data || [];
      console.log('[API] Found RSS posts:', rssPosts?.length || 0);
      if (rssPosts && rssPosts.length > 0) {
        console.log('[API] Sample RSS post:', rssPosts[0]);
      }
    } else {
      console.log('[API] No post IDs to fetch');
    }

    const postMap = new Map(rssPosts?.map(p => [p.id, p]) || []);
    console.log('[API] Post map size:', postMap.size, 'Keys:', Array.from(postMap.keys()).slice(0, 5));

    // Fetch post ratings (only if we have post IDs)
    let postRatings: any[] = [];
    if (allPostIds.length > 0) {
      const { data, error: ratingsError } = await supabase
        .from('post_ratings')
        .select(`
          post_id,
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
          final_score
        `)
        .in('post_id', allPostIds);

      if (ratingsError) {
        console.error('[API] Post ratings error:', ratingsError.message);
      }
      postRatings = data || [];
      console.log('[API] Found post ratings:', postRatings?.length || 0);
      if (postRatings && postRatings.length > 0) {
        console.log('[API] Sample rating:', postRatings[0]);
      }
    }

    const ratingsMap = new Map(postRatings?.map(r => [r.post_id, r]) || []);
    console.log('[API] Ratings map size:', ratingsMap.size);

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
    console.log('[API] Feed map size:', feedMap.size, 'Keys:', Array.from(feedMap.keys()).slice(0, 5));

    // Transform and combine articles
    const transformArticle = (article: any, isPrimary: boolean) => {
      const post = postMap.get(article.post_id);
      const campaign = campaignMap.get(article.campaign_id);
      const feed = post ? feedMap.get(post.feed_id) : null;
      const rating = ratingsMap.get(article.post_id);

      // Log if data is missing
      if (!post) {
        console.log('[API] Missing post for article:', article.id, 'post_id:', article.post_id);
      }
      if (!campaign) {
        console.log('[API] Missing campaign for article:', article.id, 'campaign_id:', article.campaign_id);
      }
      if (post && !feed) {
        console.log('[API] Missing feed for post:', post.id, 'feed_id:', post.feed_id);
      }
      if (!rating) {
        console.log('[API] Missing rating for article:', article.id, 'post_id:', article.post_id);
      }

      return {
        id: article.id,
        originalTitle: post?.title || '',
        originalDescription: post?.description || '',
        originalFullText: post?.full_article_text || '',
        publicationDate: post?.publication_date || '',
        author: post?.author || '',
        sourceUrl: post?.source_url || '',
        imageUrl: post?.image_url || '',
        feedType: isPrimary ? 'Primary' : 'Secondary',
        feedName: feed?.name || 'Unknown',

        criteria1Score: rating?.criteria_1_score || null,
        criteria1Weight: parseFloat(criteriaConfig.criteria_1_weight || '1.0'),
        criteria1Reasoning: rating?.criteria_1_reason || '',
        criteria1Name: criteriaConfig.criteria_1_name || 'Criteria 1',
        criteria1Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 1,

        criteria2Score: rating?.criteria_2_score || null,
        criteria2Weight: parseFloat(criteriaConfig.criteria_2_weight || '1.0'),
        criteria2Reasoning: rating?.criteria_2_reason || '',
        criteria2Name: criteriaConfig.criteria_2_name || 'Criteria 2',
        criteria2Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 2,

        criteria3Score: rating?.criteria_3_score || null,
        criteria3Weight: parseFloat(criteriaConfig.criteria_3_weight || '1.0'),
        criteria3Reasoning: rating?.criteria_3_reason || '',
        criteria3Name: criteriaConfig.criteria_3_name || 'Criteria 3',
        criteria3Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 3,

        criteria4Score: rating?.criteria_4_score || null,
        criteria4Weight: parseFloat(criteriaConfig.criteria_4_weight || '1.0'),
        criteria4Reasoning: rating?.criteria_4_reason || '',
        criteria4Name: criteriaConfig.criteria_4_name || 'Criteria 4',
        criteria4Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 4,

        criteria5Score: rating?.criteria_5_score || null,
        criteria5Weight: parseFloat(criteriaConfig.criteria_5_weight || '1.0'),
        criteria5Reasoning: rating?.criteria_5_reason || '',
        criteria5Name: criteriaConfig.criteria_5_name || 'Criteria 5',
        criteria5Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 5,

        totalScore: rating?.final_score || null,
        headline: article.headline || '',
        content: article.content || '',
        factCheckScore: article.fact_check_score || null,
        wordCount: article.word_count || null,
        finalPosition: article.rank || null,
        createdAt: article.created_at || '',
        campaignDate: campaign?.date || ''
      };
    };

    const allArticles = [
      ...(primaryArticles || []).map(a => transformArticle(a, true)),
      ...(secondaryArticles || []).map(a => transformArticle(a, false))
    ];

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
