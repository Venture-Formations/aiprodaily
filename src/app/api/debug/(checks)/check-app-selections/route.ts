import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-app-selections' },
  async ({ request, logger }) => {
    // Get the 5 most recent issues
    const { data: issues, error: issuesError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, created_at, status')
      .order('created_at', { ascending: false })
      .limit(5)

    if (issuesError) {
      return NextResponse.json({ error: issuesError.message }, { status: 500 })
    }

    // For each issue, get the AI app selections
    const results = await Promise.all(
      issues.map(async (issue) => {
        const { data: appSelections, error: appError } = await supabaseAdmin
          .from('issue_ai_app_selections')
          .select(`
            *,
            app:ai_applications(id, app_name, category)
          `)
          .eq('issue_id', issue.id)
          .order('selection_order', { ascending: true })

        const { data: promptSelection, error: promptError } = await supabaseAdmin
          .from('issue_prompt_selections')
          .select(`
            *,
            prompt:prompt_ideas(id, title, category)
          `)
          .eq('issue_id', issue.id)
          .single()

        return {
          issue_id: issue.id,
          issue_date: issue.date,
          issue_status: issue.status,
          created_at: issue.created_at,
          app_count: appSelections?.length || 0,
          apps: appSelections?.map(s => ({
            name: s.app?.app_name,
            category: s.app?.category,
            order: s.selection_order
          })) || [],
          prompt_selected: !!promptSelection,
          prompt: promptSelection ? {
            title: promptSelection.prompt?.title,
            category: promptSelection.prompt?.category
          } : null
        }
      })
    )

    return NextResponse.json({
      success: true,
      issues: results,
      summary: {
        total_issues: issues.length,
        campaigns_with_apps: results.filter(r => r.app_count > 0).length,
        campaigns_with_prompts: results.filter(r => r.prompt_selected).length,
        campaigns_without_apps: results.filter(r => r.app_count === 0).length,
        campaigns_without_prompts: results.filter(r => !r.prompt_selected).length
      }
    })
  }
)
