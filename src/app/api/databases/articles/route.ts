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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('page_size') || '100')));

    // Filter params (applied server-side before pagination)
    const feedTypeFilter = searchParams.get('feed_type') || 'all';
    const positionFilter = searchParams.get('position') || 'all';
    const searchTermParam = searchParams.get('search') || '';
    const minScoreParam = searchParams.get('min_score');
    const maxScoreParam = searchParams.get('max_score');
    const sortColumnParam = searchParams.get('sort_column') || 'ingestDate';
    const sortDirectionParam = searchParams.get('sort_direction') || 'desc';
    const exportAll = searchParams.get('export_all') === 'true';

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
            processed_at,
            ticker
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

    // Build ticker -> company_name lookup
    const uniqueTickers = Array.from(new Set(allRssPosts.map(p => p.ticker).filter(Boolean))) as string[];
    const companyMap = new Map<string, string>();
    if (uniqueTickers.length > 0) {
      for (let i = 0; i < uniqueTickers.length; i += CHUNK_SIZE) {
        const chunk = uniqueTickers.slice(i, i + CHUNK_SIZE);
        const { data: tickerData } = await supabase
          .from('ticker_company_names')
          .select('ticker, company_name')
          .in('ticker', chunk);
        tickerData?.forEach(t => companyMap.set(t.ticker, t.company_name));
      }
    }
    console.log('[API] Company map size:', companyMap.size);

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

      // Extract publisher name: first from title suffix ("Title - Source"), then from URL domain
      let sourceName = '';
      const title = post.title || '';
      const dashIdx = title.lastIndexOf(' - ');
      if (dashIdx > 0) {
        sourceName = title.substring(dashIdx + 3).trim();
      }
      if (!sourceName && post.source_url) {
        try {
          const hostname = new URL(post.source_url).hostname
            .replace(/^www\./, '')
            .replace(/^news\./, '')
            .replace(/^feeds\./, '')
            .replace(/^rss\./, '');
          sourceName = hostname.split('.').slice(0, -1).join('.').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        } catch {
          sourceName = '';
        }
      }

      return {
        id: post.id,
        originalTitle: post.title || '',
        originalDescription: post.description || '',
        originalFullText: post.full_article_text || '',
        publicationDate: post.publication_date || '',
        author: post.author || '',
        sourceUrl: post.source_url || '',
        sourceName,
        imageUrl: post.image_url || '',
        feedType,
        feedName: feed?.name || 'Unknown',
        ingestDate: post.processed_at || '',
        companyName: (post.ticker && companyMap.get(post.ticker)) || '',

        criteria1Score: rating?.criteria_1_score ?? null,
        criteria1Weight: parseFloat(criteriaConfig.criteria_1_weight || '1.0'),
        criteria1Reasoning: rating?.criteria_1_reason || '',
        criteria1Name: criteriaConfig.criteria_1_name || 'Criteria 1',
        criteria1Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 1 || rating?.criteria_1_score != null,

        criteria2Score: rating?.criteria_2_score ?? null,
        criteria2Weight: parseFloat(criteriaConfig.criteria_2_weight || '1.0'),
        criteria2Reasoning: rating?.criteria_2_reason || '',
        criteria2Name: criteriaConfig.criteria_2_name || 'Criteria 2',
        criteria2Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 2 || rating?.criteria_2_score != null,

        criteria3Score: rating?.criteria_3_score ?? null,
        criteria3Weight: parseFloat(criteriaConfig.criteria_3_weight || '1.0'),
        criteria3Reasoning: rating?.criteria_3_reason || '',
        criteria3Name: criteriaConfig.criteria_3_name || 'Criteria 3',
        criteria3Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 3 || rating?.criteria_3_score != null,

        criteria4Score: rating?.criteria_4_score ?? null,
        criteria4Weight: parseFloat(criteriaConfig.criteria_4_weight || '1.0'),
        criteria4Reasoning: rating?.criteria_4_reason || '',
        criteria4Name: criteriaConfig.criteria_4_name || 'Criteria 4',
        criteria4Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 4 || rating?.criteria_4_score != null,

        criteria5Score: rating?.criteria_5_score ?? null,
        criteria5Weight: parseFloat(criteriaConfig.criteria_5_weight || '1.0'),
        criteria5Reasoning: rating?.criteria_5_reason || '',
        criteria5Name: criteriaConfig.criteria_5_name || 'Criteria 5',
        criteria5Enabled: parseInt(criteriaConfig.criteria_enabled_count || '0') >= 5 || rating?.criteria_5_score != null,

        totalScore: rating?.total_score ?? null,
        finalPosition: positionMap.get(post.id) ?? null,
      };
    });

    // Collect unique feed types and positions before filtering (for filter dropdowns)
    const allFeedTypes = Array.from(new Set(allScoredPosts.map(p => p.feedType).filter(Boolean))).sort();
    const allPositions = Array.from(new Set(allScoredPosts.filter(p => p.finalPosition !== null).map(p => p.finalPosition as number))).sort((a, b) => a - b);

    // Apply server-side filters
    let filteredPosts = allScoredPosts;

    if (feedTypeFilter !== 'all') {
      filteredPosts = filteredPosts.filter(a => a.feedType === feedTypeFilter);
    }

    if (positionFilter === 'all_used') {
      filteredPosts = filteredPosts.filter(a => a.finalPosition !== null);
    } else if (positionFilter !== 'all') {
      const posNum = parseInt(positionFilter);
      if (!isNaN(posNum)) {
        filteredPosts = filteredPosts.filter(a => a.finalPosition === posNum);
      }
    }

    if (searchTermParam) {
      const term = searchTermParam.toLowerCase();
      filteredPosts = filteredPosts.filter(a =>
        a.originalTitle.toLowerCase().includes(term) ||
        a.author.toLowerCase().includes(term) ||
        a.feedName.toLowerCase().includes(term) ||
        a.sourceName.toLowerCase().includes(term) ||
        a.companyName.toLowerCase().includes(term)
      );
    }

    if (minScoreParam) {
      const minScore = parseFloat(minScoreParam);
      if (!isNaN(minScore)) {
        filteredPosts = filteredPosts.filter(a => (a.totalScore || 0) >= minScore);
      }
    }
    if (maxScoreParam) {
      const maxScore = parseFloat(maxScoreParam);
      if (!isNaN(maxScore)) {
        filteredPosts = filteredPosts.filter(a => (a.totalScore || 0) <= maxScore);
      }
    }

    // Sort
    filteredPosts.sort((a, b) => {
      const col = sortColumnParam as keyof typeof a;
      const dir = sortDirectionParam === 'asc' ? 1 : -1;
      const aVal = a[col];
      const bVal = b[col];

      if (aVal === null || aVal === undefined || aVal === '') return dir;
      if (bVal === null || bVal === undefined || bVal === '') return -dir;

      if (col === 'ingestDate' || col === 'publicationDate') {
        return dir * ((aVal as string).localeCompare(bVal as string));
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return dir * (aVal - bVal);
      }
      return dir * String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
    });

    const total = filteredPosts.length;
    const totalPages = Math.ceil(total / pageSize);

    // For CSV export, return all filtered results without pagination
    if (exportAll) {
      console.log(`[API] Export all: ${total} filtered posts`);
      return NextResponse.json({ data: filteredPosts, total, page: 1, pageSize: total, totalPages: 1, allFeedTypes, allPositions });
    }

    const startIndex = (page - 1) * pageSize;
    const paginatedPosts = filteredPosts.slice(startIndex, startIndex + pageSize);

    console.log(`[API] Scored posts: ${allScoredPosts.length} total, ${total} filtered, page ${page}/${totalPages} (${paginatedPosts.length} returned)`);

    // Check for debug parameter
    const debug = searchParams.get('debug') === 'true';
    if (debug) {
      return NextResponse.json({
        data: paginatedPosts.slice(0, 5),
        total,
        page,
        pageSize,
        totalPages,
        debug: {
          rssPostsCount: allRssPosts.length,
          postRatingsCount: postRatings.length,
          ratingsMapSize: ratingsMap.size,
          feedMapSize: feedMap.size,
          positionMapSize: positionMap.size,
        }
      });
    }

    return NextResponse.json({ data: paginatedPosts, total, page, pageSize, totalPages, allFeedTypes, allPositions });
  }
);
