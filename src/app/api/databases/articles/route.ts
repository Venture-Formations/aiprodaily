import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const newsletterSlug = searchParams.get('publication_id'); // Actually a slug, not UUID

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
          total_score
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
          .select('id, link_url, subscriber_email, issue_id')
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

      linkClicks = allClicks;
      console.log('[API] Found link clicks:', linkClicks.length);
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
    const transformArticle = (article: any, isPrimary: boolean) => {
      const post = postMap.get(article.post_id);
      const issue = issueMap.get(article.issue_id);
      const feed = post ? feedMap.get(post.feed_id) : null;
      const rating = ratingsMap.get(article.post_id);

      // Log if data is missing
      if (!post) {
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
      ...(primaryArticles || []).map(a => transformArticle(a, true)),
      ...(secondaryArticles || []).map(a => transformArticle(a, false))
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
