import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-handler';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 600;

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'databases-articles' },
  async ({ request, logger }) => {
    const supabase = supabaseAdmin;

    const { searchParams } = new URL(request.url);
    const newsletterSlug = searchParams.get('publication_id'); // Actually a slug, not UUID
    const dateFromRaw = searchParams.get('start_date');
    const dateToRaw = searchParams.get('end_date');
    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
    const dateFrom = dateFromRaw && DATE_REGEX.test(dateFromRaw) ? dateFromRaw : null;
    const dateTo = dateToRaw && DATE_REGEX.test(dateToRaw) ? dateToRaw : null;

    if (!newsletterSlug) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      );
    }

    // Convert slug to UUID (required for database queries)
    const { data: newsletter, error: newsletterError } = await supabase
      .from('publications')
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
    console.log('[API] Newsletter:', newsletterSlug, '-> UUID:', newsletterId);

    // Get scoring criteria settings (newsletter-specific)
    const { data: criteriaSettings } = await supabase
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', newsletterId)
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

    console.log('[API] Criteria settings found:', criteriaSettings?.length || 0);

    // Fetch all RSS feeds for this publication (rss_posts links through feed_id, not publication_id)
    const { data: pubFeeds } = await supabase
      .from('rss_feeds')
      .select('id, name, use_for_primary_section, use_for_secondary_section')
      .eq('publication_id', newsletterId);

    const feedList = pubFeeds || [];
    const feedIds = feedList.map(f => f.id);
    const feedMap = new Map(feedList.map(f => [f.id, f]));

    console.log('[API] Found', feedIds.length, 'feeds for publication');

    if (feedIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Fetch all scored rss_posts for these feeds, filtered by processed_at date range
    let allRssPosts: any[] = [];
    const CHUNK_SIZE = 100;

    // Query feeds in chunks to avoid .in() limit
    for (let i = 0; i < feedIds.length; i += CHUNK_SIZE) {
      const feedChunk = feedIds.slice(i, i + CHUNK_SIZE);
      let rssOffset = 0;
      const rssBatchSize = 1000;
      let hasMorePosts = true;

      while (hasMorePosts) {
        let rssQuery = supabase
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
            image_url,
            processed_at
          `)
          .in('feed_id', feedChunk);

        // Apply date range filter on processed_at (ingest date)
        if (dateFrom) {
          rssQuery = rssQuery.gte('processed_at', dateFrom);
        }
        if (dateTo) {
          rssQuery = rssQuery.lt('processed_at', dateTo + 'T23:59:59.999Z');
        }

        rssQuery = rssQuery.range(rssOffset, rssOffset + rssBatchSize - 1);

        const { data: rssBatch, error: rssError } = await rssQuery;

        if (rssError) {
          console.error('[API] RSS posts fetch error:', rssError.message);
          hasMorePosts = false;
          break;
        }

        if (!rssBatch || rssBatch.length === 0) {
          hasMorePosts = false;
        } else {
          allRssPosts = allRssPosts.concat(rssBatch);
          rssOffset += rssBatchSize;
          hasMorePosts = rssBatch.length === rssBatchSize;
        }
      }
    }

    console.log('[API] Found RSS posts:', allRssPosts.length);

    const allPostIds = allRssPosts.map(p => p.id);

    // Fetch post ratings in chunks
    let postRatings: any[] = [];
    if (allPostIds.length > 0) {
      for (let i = 0; i < allPostIds.length; i += CHUNK_SIZE) {
        const chunk = allPostIds.slice(i, i + CHUNK_SIZE);
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
            total_score
          `)
          .in('post_id', chunk);

        if (ratingsError) {
          console.error('[API] Post ratings chunk error:', ratingsError.message);
        } else if (data) {
          postRatings = postRatings.concat(data);
        }
      }
    }

    const ratingsMap = new Map(postRatings.map(r => [r.post_id, r]));
    console.log('[API] Ratings map size:', ratingsMap.size);

    // Fetch module_articles to get position (rank) for posts that were used in issues
    let moduleArticles: any[] = [];
    if (allPostIds.length > 0) {
      for (let i = 0; i < allPostIds.length; i += CHUNK_SIZE) {
        const chunk = allPostIds.slice(i, i + CHUNK_SIZE);
        const { data, error: maError } = await supabase
          .from('module_articles')
          .select('post_id, rank')
          .in('post_id', chunk);

        if (maError) {
          console.error('[API] Module articles chunk error:', maError.message);
        } else if (data) {
          moduleArticles = moduleArticles.concat(data);
        }
      }
    }

    // Build a map of post_id -> best rank (lowest position number = highest priority)
    const positionMap = new Map<string, number>();
    moduleArticles.forEach(ma => {
      if (ma.post_id && ma.rank != null) {
        const existing = positionMap.get(ma.post_id);
        if (existing == null || ma.rank < existing) {
          positionMap.set(ma.post_id, ma.rank);
        }
      }
    });

    console.log('[API] Position map size:', positionMap.size);

    // Transform posts into response shape
    const allScoredPosts = allRssPosts.map(post => {
      const feed = feedMap.get(post.feed_id);
      const rating = ratingsMap.get(post.id);

      let feedType = 'Unknown';
      if (feed) {
        feedType = feed.use_for_primary_section ? 'Primary' : (feed.use_for_secondary_section ? 'Secondary' : 'Unknown');
      }

      return {
        id: post.id,
        originalTitle: post.title || '',
        originalDescription: post.description || '',
        originalFullText: post.full_article_text || '',
        publicationDate: post.publication_date || '',
        author: post.author || '',
        sourceUrl: post.source_url || '',
        imageUrl: post.image_url || '',
        feedType,
        feedName: feed?.name || 'Unknown',
        ingestDate: post.processed_at || '',

        criteria1Score: rating?.criteria_1_score ?? null,
        criteria1Weight: parseFloat(criteriaConfig.criteria_1_weight || '1.0'),
        criteria1Reasoning: rating?.criteria_1_reason || '',
        criteria1Name: criteriaConfig.criteria_1_name || 'Criteria 1',
        criteria1Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 1,

        criteria2Score: rating?.criteria_2_score ?? null,
        criteria2Weight: parseFloat(criteriaConfig.criteria_2_weight || '1.0'),
        criteria2Reasoning: rating?.criteria_2_reason || '',
        criteria2Name: criteriaConfig.criteria_2_name || 'Criteria 2',
        criteria2Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 2,

        criteria3Score: rating?.criteria_3_score ?? null,
        criteria3Weight: parseFloat(criteriaConfig.criteria_3_weight || '1.0'),
        criteria3Reasoning: rating?.criteria_3_reason || '',
        criteria3Name: criteriaConfig.criteria_3_name || 'Criteria 3',
        criteria3Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 3,

        criteria4Score: rating?.criteria_4_score ?? null,
        criteria4Weight: parseFloat(criteriaConfig.criteria_4_weight || '1.0'),
        criteria4Reasoning: rating?.criteria_4_reason || '',
        criteria4Name: criteriaConfig.criteria_4_name || 'Criteria 4',
        criteria4Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 4,

        criteria5Score: rating?.criteria_5_score ?? null,
        criteria5Weight: parseFloat(criteriaConfig.criteria_5_weight || '1.0'),
        criteria5Reasoning: rating?.criteria_5_reason || '',
        criteria5Name: criteriaConfig.criteria_5_name || 'Criteria 5',
        criteria5Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 5,

        totalScore: rating?.total_score ?? null,
        finalPosition: positionMap.get(post.id) ?? null,
      };
    });

    // Sort by ingest date (most recent first), then by score
    allScoredPosts.sort((a, b) => {
      const dateCompare = (b.ingestDate || '').localeCompare(a.ingestDate || '');
      if (dateCompare !== 0) return dateCompare;

      const scoreA = a.totalScore || 0;
      const scoreB = b.totalScore || 0;
      return scoreB - scoreA;
    });

    console.log(`[API] Scored posts fetched: ${allScoredPosts.length} total`);

    // Check for debug parameter
    const debug = searchParams.get('debug') === 'true';
    if (debug) {
      return NextResponse.json({
        data: allScoredPosts.slice(0, 5),
        debug: {
          rssPostsCount: allRssPosts.length,
          postRatingsCount: postRatings.length,
          ratingsMapSize: ratingsMap.size,
          feedMapSize: feedMap.size,
          positionMapSize: positionMap.size,
        }
      });
    }

    return NextResponse.json({ data: allScoredPosts });
  }
);
