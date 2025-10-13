import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const campaignId = resolvedParams.id

    // Verify campaign exists before deletion
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    console.log(`Deleting campaign ${campaignId} (${campaign.date}, status: ${campaign.status})`)

    // Track deletion errors for debugging
    const deletionErrors: Record<string, any> = {}

    // Delete related records first (cascading delete)
    // Order matters - delete child records before parent records

    // 1. Delete campaign events
    const { error: campaignEventsError } = await supabaseAdmin
      .from('campaign_events')
      .delete()
      .eq('campaign_id', campaignId)

    if (campaignEventsError) {
      console.error('Error deleting campaign events:', campaignEventsError)
      deletionErrors.campaign_events = { message: campaignEventsError.message, code: campaignEventsError.code }
    }

    // 2. Delete articles associated with this campaign
    const { error: articlesError } = await supabaseAdmin
      .from('articles')
      .delete()
      .eq('campaign_id', campaignId)

    if (articlesError) {
      console.error('Error deleting campaign articles:', articlesError)
      deletionErrors.articles = { message: articlesError.message, code: articlesError.code }
    }

    // 3. Delete RSS posts associated with this campaign
    const { error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .delete()
      .eq('campaign_id', campaignId)

    if (postsError) {
      console.error('Error deleting RSS posts:', postsError)
      deletionErrors.rss_posts = { message: postsError.message, code: postsError.code }
    }

    // 4. Delete road work data associated with this campaign
    const { error: roadWorkError } = await supabaseAdmin
      .from('road_work_data')
      .delete()
      .eq('campaign_id', campaignId)

    if (roadWorkError) {
      console.error('Error deleting road work data:', roadWorkError)
      deletionErrors.road_work_data = { message: roadWorkError.message, code: roadWorkError.code }
    }

    // 4b. Delete road work items associated with this campaign
    const { error: roadWorkItemsError } = await supabaseAdmin
      .from('road_work_items')
      .delete()
      .eq('campaign_id', campaignId)

    if (roadWorkItemsError) {
      console.error('Error deleting road work items:', roadWorkItemsError)
      deletionErrors.road_work_items = { message: roadWorkItemsError.message, code: roadWorkItemsError.code }
    }

    // 4c. Delete road work selections associated with this campaign
    const { error: roadWorkSelectionsError } = await supabaseAdmin
      .from('road_work_selections')
      .delete()
      .eq('campaign_id', campaignId)

    if (roadWorkSelectionsError) {
      console.error('Error deleting road work selections:', roadWorkSelectionsError)
      deletionErrors.road_work_selections = { message: roadWorkSelectionsError.message, code: roadWorkSelectionsError.code }
    }

    // 4d. Delete dining deal selections associated with this campaign
    const { error: diningSelectionsError } = await supabaseAdmin
      .from('campaign_dining_selections')
      .delete()
      .eq('campaign_id', campaignId)

    if (diningSelectionsError) {
      console.error('Error deleting dining selections:', diningSelectionsError)
      deletionErrors.campaign_dining_selections = { message: diningSelectionsError.message, code: diningSelectionsError.code }
    }

    // 4e. Delete VRBO selections associated with this campaign
    const { error: vrboSelectionsError } = await supabaseAdmin
      .from('campaign_vrbo_selections')
      .delete()
      .eq('campaign_id', campaignId)

    if (vrboSelectionsError) {
      console.error('Error deleting VRBO selections:', vrboSelectionsError)
      deletionErrors.campaign_vrbo_selections = { message: vrboSelectionsError.message, code: vrboSelectionsError.code }
    }

    // 5. Delete user activities related to this campaign
    const { error: activitiesError } = await supabaseAdmin
      .from('user_activities')
      .delete()
      .eq('campaign_id', campaignId)

    if (activitiesError) {
      console.error('Error deleting user activities:', activitiesError)
      deletionErrors.user_activities = { message: activitiesError.message, code: activitiesError.code }
    }

    // 6. Delete archived articles associated with this campaign
    const { error: archivedArticlesError } = await supabaseAdmin
      .from('archived_articles')
      .delete()
      .eq('campaign_id', campaignId)

    if (archivedArticlesError) {
      console.error('Error deleting archived articles:', archivedArticlesError)
      deletionErrors.archived_articles = { message: archivedArticlesError.message, code: archivedArticlesError.code }
    }

    // 7. Delete archived RSS posts associated with this campaign
    const { error: archivedPostsError } = await supabaseAdmin
      .from('archived_rss_posts')
      .delete()
      .eq('campaign_id', campaignId)

    if (archivedPostsError) {
      console.error('Error deleting archived RSS posts:', archivedPostsError)
      deletionErrors.archived_rss_posts = { message: archivedPostsError.message, code: archivedPostsError.code }
    }

    // Finally delete the campaign itself
    const { error: deleteError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .delete()
      .eq('id', campaignId)

    if (deleteError) {
      console.error('Error deleting campaign:', deleteError)
      console.error('Delete error details:', JSON.stringify(deleteError, null, 2))
      console.error('Child deletion errors:', deletionErrors)
      return NextResponse.json(
        {
          error: 'Failed to delete campaign',
          details: deleteError.message || 'Unknown database error',
          code: deleteError.code || 'UNKNOWN',
          child_deletion_errors: deletionErrors
        },
        { status: 500 }
      )
    }

    console.log(`Successfully deleted campaign ${campaignId}`)

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully',
      deletedCampaign: {
        id: campaignId,
        date: campaign.date,
        status: campaign.status
      }
    })

  } catch (error) {
    console.error('Campaign deletion error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}