import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const campaignId = body.campaignId

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }

    console.log('Resetting campaign:', campaignId)

    // 1. Delete articles
    const { error: articlesError } = await supabaseAdmin
      .from('articles')
      .delete()
      .eq('campaign_id', campaignId)

    if (articlesError) {
      console.error('Error deleting articles:', articlesError)
    } else {
      console.log('✓ Deleted articles')
    }

    // 2. Delete post ratings
    const { data: posts } = await supabaseAdmin
      .from('rss_posts')
      .select('id')
      .eq('campaign_id', campaignId)

    if (posts && posts.length > 0) {
      const postIds = posts.map(p => p.id)

      const { error: ratingsError } = await supabaseAdmin
        .from('post_ratings')
        .delete()
        .in('post_id', postIds)

      if (ratingsError) {
        console.error('Error deleting ratings:', ratingsError)
      } else {
        console.log('✓ Deleted post ratings')
      }
    }

    // 3. Delete duplicate groups and posts
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('campaign_id', campaignId)

    if (duplicateGroups && duplicateGroups.length > 0) {
      const groupIds = duplicateGroups.map(g => g.id)

      await supabaseAdmin
        .from('duplicate_posts')
        .delete()
        .in('group_id', groupIds)

      await supabaseAdmin
        .from('duplicate_groups')
        .delete()
        .eq('campaign_id', campaignId)

      console.log('✓ Deleted duplicate groups')
    }

    // 4. Delete RSS posts
    const { error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .delete()
      .eq('campaign_id', campaignId)

    if (postsError) {
      console.error('Error deleting posts:', postsError)
    } else {
      console.log('✓ Deleted RSS posts')
    }

    // 5. Reset campaign subject line
    const { error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        subject_line: '',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    if (campaignError) {
      console.error('Error resetting campaign:', campaignError)
    } else {
      console.log('✓ Reset campaign subject line')
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign reset - ready for fresh RSS processing with updated prompts',
      campaign_id: campaignId
    })

  } catch (error) {
    console.error('Reset campaign error:', error)
    return NextResponse.json({
      error: 'Failed to reset campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
