import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(campaign)/reset-campaign' },
  async ({ request }) => {
    const body = await request.json()
    const issueId = body.issueId

    if (!issueId) {
      return NextResponse.json({ error: 'issueId required' }, { status: 400 })
    }

    console.log('Resetting issue:', issueId)

    // 1. Delete articles
    const { error: articlesError } = await supabaseAdmin
      .from('articles')
      .delete()
      .eq('issue_id', issueId)

    if (articlesError) {
      console.error('Error deleting articles:', articlesError)
    } else {
      console.log('Deleted articles')
    }

    // 2. Delete post ratings
    const { data: posts } = await supabaseAdmin
      .from('rss_posts')
      .select('id')
      .eq('issue_id', issueId)

    if (posts && posts.length > 0) {
      const postIds = posts.map(p => p.id)

      const { error: ratingsError } = await supabaseAdmin
        .from('post_ratings')
        .delete()
        .in('post_id', postIds)

      if (ratingsError) {
        console.error('Error deleting ratings:', ratingsError)
      } else {
        console.log('Deleted post ratings')
      }
    }

    // 3. Delete duplicate groups and posts
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('issue_id', issueId)

    if (duplicateGroups && duplicateGroups.length > 0) {
      const groupIds = duplicateGroups.map(g => g.id)

      await supabaseAdmin
        .from('duplicate_posts')
        .delete()
        .in('group_id', groupIds)

      await supabaseAdmin
        .from('duplicate_groups')
        .delete()
        .eq('issue_id', issueId)

      console.log('Deleted duplicate groups')
    }

    // 4. Delete RSS posts
    const { error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .delete()
      .eq('issue_id', issueId)

    if (postsError) {
      console.error('Error deleting posts:', postsError)
    } else {
      console.log('Deleted RSS posts')
    }

    // 5. Reset issue subject line
    const { error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        subject_line: '',
        updated_at: new Date().toISOString()
      })
      .eq('id', issueId)

    if (issueError) {
      console.error('Error resetting issue:', issueError)
    } else {
      console.log('Reset issue subject line')
    }

    return NextResponse.json({
      success: true,
      message: 'issue reset - ready for fresh RSS processing with updated prompts',
      issue_id: issueId
    })
  }
)
