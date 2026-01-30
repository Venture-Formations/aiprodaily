import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils';

export async function GET(request: NextRequest) {
  try {
    // Use the shared supabaseAdmin client for consistent behavior
    const supabase = supabaseAdmin;

    const { searchParams } = new URL(request.url);
    const newsletterSlug = searchParams.get('publication_id'); // Actually a slug, not UUID
    const excludeIpsParam = searchParams.get('exclude_ips');
    const shouldExcludeIps = excludeIpsParam !== 'false'; // Default to true

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
    console.log('[API] Newsletter:', newsletterSlug, '→ UUID:', newsletterId);

    // Fetch excluded IPs for this publication (for filtering click analytics)
    let exclusions: IPExclusion[] = [];
    if (shouldExcludeIps) {
      const { data: excludedIpsData } = await supabase
        .from('excluded_ips')
        .select('ip_address, is_range, cidr_prefix')
        .eq('publication_id', newsletterId);

      exclusions = (excludedIpsData || []).map(e => ({
        ip_address: e.ip_address,
        is_range: e.is_range || false,
        cidr_prefix: e.cidr_prefix
      }));

      if (exclusions.length > 0) {
        console.log('[API] Loaded', exclusions.length, 'IP exclusions for click filtering');
      }
    }

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
    console.log('[API] Criteria config:', JSON.stringify(criteriaConfig, null, 2));

    // First, get issues for this newsletter (with email_metrics for recipient counts and mailerlite_issue_id)
    // The mailerlite_issue_id from email_metrics handles both old (pre-12/08) and new click tracking formats
    // Use pagination to handle more than 1000 issues (Supabase default limit)
    let allIssuesRaw: any[] = [];
    let issuesOffset = 0;
    const issuesBatchSize = 1000;
    let hasMoreIssues = true;

    while (hasMoreIssues) {
      const { data: issuesBatch, error: issuesError } = await supabase
        .from('publication_issues')
        .select(`
          id,
          date,
          publication_id,
          status,
          email_metrics(sent_count, mailerlite_issue_id)
        `)
        .eq('publication_id', newsletterId)
        .range(issuesOffset, issuesOffset + issuesBatchSize - 1);

      if (issuesError) {
        console.error('[API] Issues fetch error:', issuesError.message);
        break;
      }

      if (!issuesBatch || issuesBatch.length === 0) {
        hasMoreIssues = false;
      } else {
        allIssuesRaw = allIssuesRaw.concat(issuesBatch);
        issuesOffset += issuesBatchSize;
        hasMoreIssues = issuesBatch.length === issuesBatchSize;
      }
    }

    const issuesRaw = allIssuesRaw;

    // Transform email_metrics from array to single object
    const issues = (issuesRaw || []).map((issue: any) => ({
      ...issue,
      email_metrics: Array.isArray(issue.email_metrics) && issue.email_metrics.length > 0
        ? issue.email_metrics[0]
        : null
    }));

    console.log('[API] Found issues:', issues?.length || 0);

    // Log sample of issue dates to help diagnose N/A issue dates
    if (issues && issues.length > 0) {
      const issueDateSamples = issues.slice(0, 5).map((i: any) => ({ id: i.id, date: i.date }));
      console.log('[API] Sample issue dates:', JSON.stringify(issueDateSamples));
      const issuesWithNullDates = issues.filter((i: any) => !i.date);
      if (issuesWithNullDates.length > 0) {
        console.warn('[API] WARNING: Found', issuesWithNullDates.length, 'issues with null/empty dates');
      }
    }

    const issueIds = (issues || []).map(c => c.id);
    const issueMap = new Map((issues || []).map(c => [c.id, c]));

    // Build mapping from mailerlite_issue_id to database issue_id
    // This handles clicks from before 12/08/2025 when issue_id was mailerlite ID
    const mailerliteToDbIdMap = new Map<string, string>();
    (issues || []).forEach((issue: any) => {
      const mailerliteIssueId = issue.email_metrics?.mailerlite_issue_id;
      if (mailerliteIssueId) {
        mailerliteToDbIdMap.set(mailerliteIssueId, issue.id);
      }
    });

    // Fetch primary articles - filter by issue_id if we have issues
    let primaryQuery = supabase
      .from('articles')
      .select(`
        id,
        post_id,
        issue_id,
        headline,
        content,
        rank,
        fact_check_score,
        word_count,
        created_at
      `);

    if (issueIds.length > 0) {
      primaryQuery = primaryQuery.in('issue_id', issueIds);
    }

    const { data: primaryArticles, error: primaryError } = await primaryQuery;

    if (primaryError) {
      console.error('[API] Primary articles error:', primaryError.message);
      throw primaryError;
    }

    console.log('[API] Found primary articles:', primaryArticles?.length || 0);
    if (primaryArticles && primaryArticles.length > 0) {
      console.log('[API] Sample primary article:', { id: primaryArticles[0].id, post_id: primaryArticles[0].post_id, issue_id: primaryArticles[0].issue_id });
    }

    // Fetch secondary articles - filter by issue_id if we have issues
    let secondaryQuery = supabase
      .from('secondary_articles')
      .select(`
        id,
        post_id,
        issue_id,
        headline,
        content,
        rank,
        fact_check_score,
        word_count,
        created_at
      `);

    if (issueIds.length > 0) {
      secondaryQuery = secondaryQuery.in('issue_id', issueIds);
    }

    const { data: secondaryArticles, error: secondaryError } = await secondaryQuery;

    if (secondaryError) {
      console.error('[API] Secondary articles error:', secondaryError.message);
      throw secondaryError;
    }

    console.log('[API] Found secondary articles:', secondaryArticles?.length || 0);

    // Fetch module articles (from the new article modules system)
    // Use pagination to handle more than 1000 module articles (Supabase default limit)
    let allModuleArticles: any[] = [];
    let moduleArticlesOffset = 0;
    const moduleArticlesBatchSize = 1000;
    let hasMoreModuleArticles = true;

    while (hasMoreModuleArticles) {
      let moduleArticlesQuery = supabase
        .from('module_articles')
        .select(`
          id,
          post_id,
          issue_id,
          article_module_id,
          headline,
          content,
          rank,
          fact_check_score,
          word_count,
          created_at
        `)
        .range(moduleArticlesOffset, moduleArticlesOffset + moduleArticlesBatchSize - 1);

      if (issueIds.length > 0) {
        moduleArticlesQuery = moduleArticlesQuery.in('issue_id', issueIds);
      }

      const { data: moduleArticlesBatch, error: moduleArticlesError } = await moduleArticlesQuery;

      if (moduleArticlesError) {
        console.error('[API] Module articles fetch error:', moduleArticlesError.message);
        break;
      }

      if (!moduleArticlesBatch || moduleArticlesBatch.length === 0) {
        hasMoreModuleArticles = false;
      } else {
        allModuleArticles = allModuleArticles.concat(moduleArticlesBatch);
        moduleArticlesOffset += moduleArticlesBatchSize;
        hasMoreModuleArticles = moduleArticlesBatch.length === moduleArticlesBatchSize;
      }
    }

    const moduleArticles = allModuleArticles;

    console.log('[API] Found module articles:', moduleArticles?.length || 0);

    // Fetch article modules for module name lookup
    const moduleIds = (moduleArticles || [])
      .map(a => a.article_module_id)
      .filter((id, index, self) => id && self.indexOf(id) === index);

    let articleModulesMap = new Map<string, string>();
    if (moduleIds.length > 0) {
      const { data: articleModules } = await supabase
        .from('article_modules')
        .select('id, name')
        .in('id', moduleIds);

      if (articleModules) {
        articleModules.forEach(m => articleModulesMap.set(m.id, m.name));
      }
    }

    console.log('[API] Article modules map size:', articleModulesMap.size);

    // Get all post IDs (including from module articles)
    const rawPostIds = [
      ...(primaryArticles || []).map(a => a.post_id),
      ...(secondaryArticles || []).map(a => a.post_id),
      ...(moduleArticles || []).map(a => a.post_id)
    ];

    // Debug: Log raw post IDs before filtering
    console.log('[API] Raw post IDs (before filter):', rawPostIds.length, 'Sample:', rawPostIds.slice(0, 5));
    const nullCount = rawPostIds.filter(id => !id).length;
    if (nullCount > 0) {
      console.warn('[API] Found', nullCount, 'null/undefined post_ids');
    }

    const allPostIds = rawPostIds.filter((id, index, self) => id && self.indexOf(id) === index);
    console.log('[API] Post IDs to fetch:', allPostIds.length, 'Sample IDs:', allPostIds.slice(0, 5), 'Types:', allPostIds.slice(0, 3).map(id => typeof id));

    // Fetch RSS posts (only if we have post IDs)
    // Use chunked queries to avoid Supabase .in() limit (fails silently with large arrays)
    const CHUNK_SIZE = 100;
    let rssPosts: any[] = [];
    if (allPostIds.length > 0) {
      console.log('[API] Fetching RSS posts for', allPostIds.length, 'post_ids in chunks of', CHUNK_SIZE);

      for (let i = 0; i < allPostIds.length; i += CHUNK_SIZE) {
        const chunk = allPostIds.slice(i, i + CHUNK_SIZE);
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
          .in('id', chunk);

        if (rssPostsError) {
          console.error('[API] RSS posts chunk error:', rssPostsError.message, 'Chunk:', i, '-', i + chunk.length);
        } else if (data) {
          rssPosts = rssPosts.concat(data);
        }
      }

      console.log('[API] RSS posts query returned:', rssPosts.length, 'rows from', Math.ceil(allPostIds.length / CHUNK_SIZE), 'chunks');

      if (rssPosts.length > 0) {
        console.log('[API] Sample RSS post:', rssPosts[0]);
      }
    } else {
      console.log('[API] No post IDs to fetch');
    }

    const postMap = new Map(rssPosts?.map(p => [p.id, p]) || []);
    console.log('[API] Post map size:', postMap.size, 'Keys:', Array.from(postMap.keys()).slice(0, 5));

    // Fetch post ratings (only if we have post IDs)
    // Use chunked queries to avoid Supabase .in() limit (fails silently with large arrays)
    let postRatings: any[] = [];
    if (allPostIds.length > 0) {
      console.log('[API] Fetching post ratings for', allPostIds.length, 'post_ids in chunks of', CHUNK_SIZE);

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
          console.error('[API] Post ratings chunk error:', ratingsError.message, 'Chunk:', i, '-', i + chunk.length);
        } else if (data) {
          postRatings = postRatings.concat(data);
        }
      }

      console.log('[API] Post ratings query returned:', postRatings.length, 'rows from', Math.ceil(allPostIds.length / CHUNK_SIZE), 'chunks');

      if (postRatings.length > 0) {
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

    // Fetch link clicks for sent issues to calculate article metrics
    // We'll match clicks to articles by source_url and issue_id
    // NOTE: Before 12/08/2025, issue_id in link_clicks was mailerlite_issue_id
    // After 12/08/2025, issue_id is the database UUID. We need to handle both.
    let linkClicks: any[] = [];
    const sentIssues = issues.filter(i => i.status === 'sent');
    const sentIssueIds = sentIssues.map(i => i.id);
    const sentMailerliteIds = sentIssues
      .map(i => i.email_metrics?.mailerlite_issue_id)
      .filter((id: string | null | undefined) => id); // Filter out null/undefined

    // Combine both ID types for the query
    const allIssueIdFormats = [...sentIssueIds, ...sentMailerliteIds];

    if (allIssueIdFormats.length > 0) {
      // Fetch in batches to avoid pagination limits
      let allClicks: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        const { data: clicksBatch, error: clicksError } = await supabase
          .from('link_clicks')
          .select('id, link_url, subscriber_email, issue_id, ip_address')
          .in('issue_id', allIssueIdFormats)
          .range(offset, offset + batchSize - 1);

        if (clicksError) {
          console.error('[API] Link clicks error:', clicksError.message);
          break;
        }

        if (!clicksBatch || clicksBatch.length === 0) {
          hasMore = false;
        } else {
          allClicks = allClicks.concat(clicksBatch);
          offset += batchSize;
          hasMore = clicksBatch.length === batchSize;
        }
      }

      // Filter out excluded IPs from analytics (only if enabled)
      if (shouldExcludeIps && exclusions.length > 0) {
        const totalFetched = allClicks.length;
        linkClicks = allClicks.filter(click => !isIPExcluded(click.ip_address, exclusions));
        const excludedCount = totalFetched - linkClicks.length;
        if (excludedCount > 0) {
          console.log('[API] Filtered', excludedCount, 'clicks from', exclusions.length, 'excluded IP(s)');
        }
      } else {
        linkClicks = allClicks;
      }
      console.log('[API] Found link clicks:', linkClicks.length, '(IP exclusion', shouldExcludeIps ? 'enabled' : 'disabled', ')');
    }

    // Build a map of clicks by issue_id + normalized source_url for quick lookup
    // Key format: "db_issue_id|normalized_url" (always use database UUID as key)
    const normalizeUrl = (url: string): string => {
      if (!url) return '';
      return url.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .trim();
    };

    // Group clicks by issue_id and link_url
    // Normalize mailerlite IDs to database UUIDs for consistent matching
    const clicksMap = new Map<string, { totalClicks: number; uniqueClickers: Set<string> }>();
    linkClicks.forEach(click => {
      if (!click.issue_id || !click.link_url) return;

      // Convert mailerlite_issue_id to database UUID if needed
      let dbIssueId = click.issue_id;
      if (mailerliteToDbIdMap.has(click.issue_id)) {
        dbIssueId = mailerliteToDbIdMap.get(click.issue_id)!;
      }

      const key = `${dbIssueId}|${normalizeUrl(click.link_url)}`;
      if (!clicksMap.has(key)) {
        clicksMap.set(key, { totalClicks: 0, uniqueClickers: new Set() });
      }
      const entry = clicksMap.get(key)!;
      entry.totalClicks++;
      if (click.subscriber_email) {
        entry.uniqueClickers.add(click.subscriber_email);
      }
    });

    console.log('[API] Clicks map size:', clicksMap.size);

    // Transform and combine articles
    // feedTypeOverride: optional string to override feed type (for module articles)
    const transformArticle = (article: any, feedTypeOverride?: string) => {
      const post = postMap.get(article.post_id);
      const issue = issueMap.get(article.issue_id);
      const feed = post ? feedMap.get(post.feed_id) : null;
      const rating = ratingsMap.get(article.post_id);

      // Log if data is missing (only log once per run for performance)
      if (!post && article.post_id) {
        console.log('[API] Missing post for article:', article.id, 'post_id:', article.post_id);
      }
      if (!issue) {
        console.log('[API] Missing issue for article:', article.id, 'issue_id:', article.issue_id);
      } else if (!issue.date) {
        console.log('[API] Issue exists but date is null/empty for article:', article.id, 'issue_id:', article.issue_id, 'issue:', JSON.stringify(issue));
      }
      if (post && !feed) {
        console.log('[API] Missing feed for post:', post.id, 'feed_id:', post.feed_id);
      }

      // Determine feed type - use override if provided, else derive from feed settings
      let feedType = feedTypeOverride || 'Unknown';
      if (!feedTypeOverride && feed) {
        feedType = feed.use_for_primary_section ? 'Primary' : (feed.use_for_secondary_section ? 'Secondary' : 'Unknown');
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
        feedType,
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

        totalScore: rating?.total_score || null,
        headline: article.headline || '',
        content: article.content || '',
        factCheckScore: article.fact_check_score || null,
        wordCount: article.word_count || null,
        finalPosition: article.rank || null,
        createdAt: article.created_at || '',
        issueDate: issue?.date || '',

        // Click metrics (only for sent articles with position)
        ...(() => {
          // Only calculate metrics for articles with a position (actually sent)
          if (!article.rank || !post?.source_url || !article.issue_id) {
            return {
              uniqueClickers: null,
              totalClicks: null,
              totalRecipients: null,
              ctr: null
            };
          }

          const clickKey = `${article.issue_id}|${normalizeUrl(post.source_url)}`;
          const clickData = clicksMap.get(clickKey);
          const uniqueClickers = clickData?.uniqueClickers.size || 0;
          const totalClicks = clickData?.totalClicks || 0;
          const totalRecipients = issue?.email_metrics?.sent_count || null;

          // Calculate CTR (unique clickers / total recipients * 100)
          let ctr: number | null = null;
          if (totalRecipients && totalRecipients > 0) {
            ctr = Math.round((uniqueClickers / totalRecipients) * 10000) / 100; // 2 decimal places
          }

          return {
            uniqueClickers,
            totalClicks,
            totalRecipients,
            ctr
          };
        })()
      };
    };

    const allArticles = [
      ...(primaryArticles || []).map(a => transformArticle(a, 'Primary')),
      ...(secondaryArticles || []).map(a => transformArticle(a, 'Secondary')),
      ...(moduleArticles || []).map(a => {
        // Get module name for feed type display
        const moduleName = a.article_module_id ? articleModulesMap.get(a.article_module_id) : null;
        return transformArticle(a, moduleName || 'Module');
      })
    ];

    // Sort by issue date (most recent first), then by final position
    allArticles.sort((a, b) => {
      const dateCompare = (b?.issueDate || '').localeCompare(a?.issueDate || '');
      if (dateCompare !== 0) return dateCompare;

      const posA = a?.finalPosition || 999;
      const posB = b?.finalPosition || 999;
      return posA - posB;
    });

    console.log(`[API] Articles fetched: ${allArticles.length} total`);

    // Check for debug parameter
    const debug = searchParams.get('debug') === 'true';
    if (debug) {
      return NextResponse.json({
        data: allArticles.slice(0, 5),
        debug: {
          issuesCount: issues?.length || 0,
          primaryArticlesCount: primaryArticles?.length || 0,
          secondaryArticlesCount: secondaryArticles?.length || 0,
          moduleArticlesCount: moduleArticles?.length || 0,
          articleModulesCount: articleModulesMap.size,
          postIdsCount: allPostIds.length,
          postIdsSample: allPostIds.slice(0, 5),
          rssPostsCount: rssPosts?.length || 0,
          postMapSize: postMap.size,
          postMapKeysSample: Array.from(postMap.keys()).slice(0, 5),
          postRatingsCount: postRatings?.length || 0,
          ratingsMapSize: ratingsMap.size,
          // Check if first article's post_id is in the map
          firstArticleCheck: primaryArticles && primaryArticles.length > 0 ? {
            articleId: primaryArticles[0].id,
            articlePostId: primaryArticles[0].post_id,
            postFound: postMap.has(primaryArticles[0].post_id),
            postData: postMap.get(primaryArticles[0].post_id) ? {
              id: postMap.get(primaryArticles[0].post_id).id,
              title: postMap.get(primaryArticles[0].post_id).title?.slice(0, 50)
            } : null
          } : null
        }
      });
    }

    return NextResponse.json({ data: allArticles });

  } catch (error: any) {
    console.error('[API] Articles fetch error:', error.message);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export const maxDuration = 600;
