import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const newsletterSlug = searchParams.get('publication_id') || 'accounting';

    // Get publication ID
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', newsletterSlug)
      .single();

    if (newsletterError || !newsletter) {
      return NextResponse.json({ error: 'Newsletter not found', newsletterError });
    }

    // Get a few recent articles
    const { data: articles, error: articlesError } = await supabaseAdmin
      .from('articles')
      .select('id, post_id, headline, issue_id')
      .order('created_at', { ascending: false })
      .limit(5);

    if (articlesError) {
      return NextResponse.json({ error: 'Articles fetch error', articlesError });
    }

    // Get the post_ids from articles
    const postIds = articles?.map(a => a.post_id).filter(Boolean) || [];

    // Test 1: Check if post_ids exist in rss_posts
    const { data: rssPosts, error: rssError } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title')
      .in('id', postIds);

    // Test 2: Try fetching one post directly
    let singlePostResult = null;
    if (postIds.length > 0) {
      const { data: singlePost, error: singleError } = await supabaseAdmin
        .from('rss_posts')
        .select('id, title, source_url')
        .eq('id', postIds[0])
        .single();

      singlePostResult = { data: singlePost, error: singleError };
    }

    // Test 3: Get any 5 rss_posts to verify table access
    const { data: anyPosts, error: anyPostsError } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title')
      .limit(5);

    // Test 4: Check post_ratings
    const { data: ratings, error: ratingsError } = await supabaseAdmin
      .from('post_ratings')
      .select('post_id, total_score')
      .in('post_id', postIds);

    return NextResponse.json({
      newsletter: newsletter.id,
      articles: articles?.length || 0,
      articleSamples: articles?.slice(0, 3).map(a => ({ id: a.id, post_id: a.post_id, headline: a.headline?.slice(0, 50) })),
      postIds: postIds.slice(0, 5),
      postIdTypes: postIds.slice(0, 3).map(id => typeof id),
      rssPostsFound: rssPosts?.length || 0,
      rssError: rssError ? { message: rssError.message, code: rssError.code } : null,
      singlePostResult,
      anyPostsInTable: anyPosts?.length || 0,
      anyPostsSample: anyPosts?.slice(0, 2),
      anyPostsError: anyPostsError ? { message: anyPostsError.message } : null,
      ratingsFound: ratings?.length || 0,
      ratingsError: ratingsError ? { message: ratingsError.message } : null,
      ratingsSample: ratings?.slice(0, 2)
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
