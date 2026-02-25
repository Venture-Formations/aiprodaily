import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/delete' },
  async ({ params }) => {
    const issueId = params.id

    // Verify issue exists before deletion
    const { data: issue, error: fetchError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status')
      .eq('id', issueId)
      .single()

    if (fetchError || !issue) {
      return NextResponse.json(
        { error: 'issue not found' },
        { status: 404 }
      )
    }

    console.log(`Deleting issue ${issueId} (${issue.date}, status: ${issue.status})`)

    // Track deletion errors for debugging
    const deletionErrors: Record<string, any> = {}

    // Delete related records first (cascading delete)
    // Order matters - delete child records before parent records

    // 1. Delete issue events
    const { error: issueEventsError } = await supabaseAdmin
      .from('issue_events')
      .delete()
      .eq('issue_id', issueId)

    if (issueEventsError) {
      console.error('Error deleting issue events:', issueEventsError)
      deletionErrors.issue_events = { message: issueEventsError.message, code: issueEventsError.code }
    }

    // 2. Delete articles (permanently remove generated content)
    const { error: articlesError } = await supabaseAdmin
      .from('articles')
      .delete()
      .eq('issue_id', issueId)

    if (articlesError) {
      console.error('Error deleting articles:', articlesError)
      deletionErrors.articles = { message: articlesError.message, code: articlesError.code }
    }

    // 2b. Delete secondary articles (permanently remove generated content)
    const { error: secondaryArticlesError } = await supabaseAdmin
      .from('secondary_articles')
      .delete()
      .eq('issue_id', issueId)

    if (secondaryArticlesError) {
      console.error('Error deleting secondary articles:', secondaryArticlesError)
      deletionErrors.secondary_articles = { message: secondaryArticlesError.message, code: secondaryArticlesError.code }
    }

    // 2c. Delete module articles (new article modules system)
    const { error: moduleArticlesError } = await supabaseAdmin
      .from('module_articles')
      .delete()
      .eq('issue_id', issueId)

    if (moduleArticlesError) {
      console.error('Error deleting module articles:', moduleArticlesError)
      deletionErrors.module_articles = { message: moduleArticlesError.message, code: moduleArticlesError.code }
    }

    // 2d. Delete issue article module selections
    const { error: issueArticleModulesError } = await supabaseAdmin
      .from('issue_article_modules')
      .delete()
      .eq('issue_id', issueId)

    if (issueArticleModulesError) {
      console.error('Error deleting issue article modules:', issueArticleModulesError)
      deletionErrors.issue_article_modules = { message: issueArticleModulesError.message, code: issueArticleModulesError.code }
    }

    // 3. Unassign RSS posts (set issueId to null instead of deleting)
    const { error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .update({ issue_id: null })
      .eq('issue_id', issueId)

    if (postsError) {
      console.error('Error unassigning RSS posts:', postsError)
      deletionErrors.rss_posts = { message: postsError.message, code: postsError.code }
    }

    // 4. Delete road work data associated with this issue
    const { error: roadWorkError } = await supabaseAdmin
      .from('road_work_data')
      .delete()
      .eq('issue_id', issueId)

    if (roadWorkError) {
      console.error('Error deleting road work data:', roadWorkError)
      deletionErrors.road_work_data = { message: roadWorkError.message, code: roadWorkError.code }
    }

    // 4b. Delete road work items associated with this issue
    const { error: roadWorkItemsError } = await supabaseAdmin
      .from('road_work_items')
      .delete()
      .eq('issue_id', issueId)

    if (roadWorkItemsError) {
      console.error('Error deleting road work items:', roadWorkItemsError)
      deletionErrors.road_work_items = { message: roadWorkItemsError.message, code: roadWorkItemsError.code }
    }

    // 4c. Delete road work selections associated with this issue
    const { error: roadWorkSelectionsError } = await supabaseAdmin
      .from('road_work_selections')
      .delete()
      .eq('issue_id', issueId)

    if (roadWorkSelectionsError) {
      console.error('Error deleting road work selections:', roadWorkSelectionsError)
      deletionErrors.road_work_selections = { message: roadWorkSelectionsError.message, code: roadWorkSelectionsError.code }
    }

    // 4d. Delete dining deal selections associated with this issue
    const { error: diningSelectionsError } = await supabaseAdmin
      .from('issue_dining_selections')
      .delete()
      .eq('issue_id', issueId)

    if (diningSelectionsError) {
      console.error('Error deleting dining selections:', diningSelectionsError)
      deletionErrors.issue_dining_selections = { message: diningSelectionsError.message, code: diningSelectionsError.code }
    }

    // 4e. Delete VRBO selections associated with this issue
    const { error: vrboSelectionsError } = await supabaseAdmin
      .from('issue_vrbo_selections')
      .delete()
      .eq('issue_id', issueId)

    if (vrboSelectionsError) {
      console.error('Error deleting VRBO selections:', vrboSelectionsError)
      deletionErrors.issue_vrbo_selections = { message: vrboSelectionsError.message, code: vrboSelectionsError.code }
    }

    // 5. Delete user activities related to this issue
    const { error: activitiesError } = await supabaseAdmin
      .from('user_activities')
      .delete()
      .eq('issue_id', issueId)

    if (activitiesError) {
      console.error('Error deleting user activities:', activitiesError)
      deletionErrors.user_activities = { message: activitiesError.message, code: activitiesError.code }
    }

    // 6. Delete archived articles associated with this issue
    const { error: archivedArticlesError } = await supabaseAdmin
      .from('archived_articles')
      .delete()
      .eq('issue_id', issueId)

    if (archivedArticlesError) {
      console.error('Error deleting archived articles:', archivedArticlesError)
      deletionErrors.archived_articles = { message: archivedArticlesError.message, code: archivedArticlesError.code }
    }

    // 7. Delete archived RSS posts associated with this issue
    const { error: archivedPostsError } = await supabaseAdmin
      .from('archived_rss_posts')
      .delete()
      .eq('issue_id', issueId)

    if (archivedPostsError) {
      console.error('Error deleting archived RSS posts:', archivedPostsError)
      deletionErrors.archived_rss_posts = { message: archivedPostsError.message, code: archivedPostsError.code }
    }

    // Finally delete the issue itself
    const { error: deleteError } = await supabaseAdmin
      .from('publication_issues')
      .delete()
      .eq('id', issueId)

    if (deleteError) {
      console.error('Error deleting issue:', deleteError)
      console.error('Delete error details:', JSON.stringify(deleteError, null, 2))
      console.error('Child deletion errors:', deletionErrors)
      return NextResponse.json(
        {
          error: 'Failed to delete issue',
          details: deleteError.message || 'Unknown database error',
          code: deleteError.code || 'UNKNOWN',
          child_deletion_errors: deletionErrors
        },
        { status: 500 }
      )
    }

    console.log(`Successfully deleted issue ${issueId}`)

    return NextResponse.json({
      success: true,
      message: 'issue deleted successfully',
      deletedissue: {
        id: issueId,
        date: issue.date,
        status: issue.status
      }
    })
  }
)
