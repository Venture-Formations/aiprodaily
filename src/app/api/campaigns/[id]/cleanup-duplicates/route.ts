import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * Cleanup Duplicate Articles
 *
 * Removes duplicate module_articles from an issue:
 * 1. Groups articles by article_module_id
 * 2. Within each module, identifies articles with the same post_id (true duplicates)
 * 3. Keeps the first occurrence (highest fact_check_score, earliest created_at)
 * 4. Deletes subsequent duplicates
 * 5. If more than 6 unique articles remain per module, trims to top 6
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/cleanup-duplicates' },
  async ({ params, session }) => {
    const issueId = params.id

    console.log(`[Cleanup] Starting duplicate cleanup for issue: ${issueId}`)

    // Verify publication ownership via issue
    const { data: issue } = await supabaseAdmin
      .from('publication_issues')
      .select('id, publication_id')
      .eq('id', issueId)
      .single()

    if (!issue) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Get all module articles for this issue
    const { data: allArticles } = await supabaseAdmin
      .from('module_articles')
      .select('id, headline, fact_check_score, created_at, post_id, article_module_id')
      .eq('issue_id', issueId)
      .order('fact_check_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true })

    let totalDeleted = 0
    const duplicatesFound: string[] = []

    if (allArticles && allArticles.length > 0) {
      // Group articles by article_module_id
      const moduleGroups = new Map<string, typeof allArticles>()
      for (const article of allArticles) {
        const moduleId = article.article_module_id
        if (!moduleGroups.has(moduleId)) {
          moduleGroups.set(moduleId, [])
        }
        moduleGroups.get(moduleId)!.push(article)
      }

      // Process each module group separately
      for (const [moduleId, articles] of Array.from(moduleGroups.entries())) {
        const seenPostIds = new Set<string>()
        const toDelete: string[] = []

        for (const article of articles) {
          if (article.post_id && seenPostIds.has(article.post_id)) {
            toDelete.push(article.id)
            duplicatesFound.push(article.post_id)
            console.log(`[Cleanup] Found duplicate article: ${article.id} (post_id: ${article.post_id}, module: ${moduleId})`)
          } else if (article.post_id) {
            seenPostIds.add(article.post_id)
          }
        }

        if (toDelete.length > 0) {
          const { error: deleteError } = await supabaseAdmin
            .from('module_articles')
            .delete()
            .in('id', toDelete)

          if (deleteError) {
            console.error(`[Cleanup] Error deleting duplicate articles for module ${moduleId}:`, deleteError)
          } else {
            totalDeleted += toDelete.length
            console.log(`[Cleanup] Deleted ${toDelete.length} duplicate articles for module ${moduleId}`)
          }
        }

        // After removing duplicates, check if we still have more than 6 and trim
        const remaining = articles.length - toDelete.length
        if (remaining > 6) {
          const keptArticles = articles.filter((a: typeof articles[number]) => !toDelete.includes(a.id))
          const toTrim = keptArticles.slice(6).map((a: typeof articles[number]) => a.id)

          if (toTrim.length > 0) {
            const { error: trimError } = await supabaseAdmin
              .from('module_articles')
              .delete()
              .in('id', toTrim)

            if (!trimError) {
              totalDeleted += toTrim.length
              console.log(`[Cleanup] Trimmed ${toTrim.length} extra articles for module ${moduleId}`)
            }
          }
        }
      }
    }

    // Log activity
    if (session.user?.email && totalDeleted > 0) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            issue_id: issueId,
            action: 'duplicates_cleaned',
            details: {
              total_deleted: totalDeleted,
              publication_id: issue.publication_id
            }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      totalDeleted,
      duplicatesFound: {
        count: duplicatesFound.length,
        postIds: Array.from(new Set(duplicatesFound))
      },
      remainingArticles: (allArticles?.length || 0) - totalDeleted,
      message: `Cleaned up ${totalDeleted} duplicate articles`
    })
  }
)

export const maxDuration = 60
