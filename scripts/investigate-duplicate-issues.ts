import { supabaseAdmin } from '../src/lib/supabase';

async function investigate() {
  const supabase = supabaseAdmin;
  // Get issue details
  const { data: issues } = await supabase
    .from('publication_issues')
    .select('id, date, status, created_at')
    .in('id', ['d8679cfd-c2a2-42c0-aa1a-ca6a612ba0af', 'f546382b-54e6-4d3f-8edf-79bc20541b85'])
    .order('date');

  console.log('\n=== ISSUES ===');
  issues?.forEach(i => {
    console.log(`ID: ${i.id}`);
    console.log(`Date: ${i.date}`);
    console.log(`Status: ${i.status}`);
    console.log(`Created: ${i.created_at}`);
    console.log('---');
  });

  // Get articles for each issue
  for (const issue of issues || []) {
    const { data: articles } = await supabase
      .from('articles')
      .select('id, post_id, headline, is_active')
      .eq('issue_id', issue.id);

    console.log(`\nIssue ${issue.id.substring(0,8)}... (${issue.date}) has ${articles?.length} articles`);

    if (articles && articles.length > 0) {
      const postIds = articles.filter(a => a.post_id).map(a => a.post_id);
      const { data: posts } = await supabase
        .from('rss_posts')
        .select('id, title, feed_id, content, full_article_text')
        .in('id', postIds);

      console.log('Articles:');
      posts?.forEach(p => {
        const contentPreview = (p.full_article_text || p.content || '').substring(0, 100);
        console.log(`  - ${p.title?.substring(0, 50)}...`);
        console.log(`    Post ID: ${p.id}, Feed: ${p.feed_id}`);
        console.log(`    Content preview: ${contentPreview}...`);
        console.log('');
      });
    }
  }

  // Check for duplicate groups
  console.log('\n=== DEDUPLICATION RECORDS ===');
  for (const issue of issues || []) {
    const { data: groups } = await supabase
      .from('duplicate_groups')
      .select('id, primary_post_id, topic_signature')
      .eq('issue_id', issue.id);

    console.log(`Issue ${issue.id.substring(0,8)}... has ${groups?.length || 0} duplicate groups`);
    groups?.forEach(g => {
      console.log(`  - ${g.topic_signature}`);
    });
  }
}

investigate().catch(console.error);
