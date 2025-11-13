import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to verify AI features database setup
 * GET /api/debug/verify-ai-features
 */
export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      tables: {},
      sample_data: {}
    }

    // Check ai_applications table
    const { data: apps, error: appsError } = await supabaseAdmin
      .from('ai_applications')
      .select('*')
      .limit(5)

    results.tables.ai_applications = {
      exists: !appsError,
      error: appsError?.message || null,
      count: apps?.length || 0
    }
    results.sample_data.ai_applications = apps || []

    // Check prompt_ideas table
    const { data: prompts, error: promptsError } = await supabaseAdmin
      .from('prompt_ideas')
      .select('*')
      .limit(5)

    results.tables.prompt_ideas = {
      exists: !promptsError,
      error: promptsError?.message || null,
      count: prompts?.length || 0
    }
    results.sample_data.prompt_ideas = prompts || []

    // Check issue_ai_app_selections table
    const { data: appSelections, error: appSelectionsError } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select('*')
      .limit(5)

    results.tables.issue_ai_app_selections = {
      exists: !appSelectionsError,
      error: appSelectionsError?.message || null,
      count: appSelections?.length || 0
    }

    // Check issue_prompt_selections table
    const { data: promptSelections, error: promptSelectionsError } = await supabaseAdmin
      .from('issue_prompt_selections')
      .select('*')
      .limit(5)

    results.tables.issue_prompt_selections = {
      exists: !promptSelectionsError,
      error: promptSelectionsError?.message || null,
      count: promptSelections?.length || 0
    }

    // Overall status
    const allTablesExist =
      results.tables.ai_applications.exists &&
      results.tables.prompt_ideas.exists &&
      results.tables.issue_ai_app_selections.exists &&
      results.tables.issue_prompt_selections.exists

    results.status = allTablesExist ? 'READY' : 'INCOMPLETE'
    results.message = allTablesExist
      ? 'AI features are ready! All tables exist.'
      : 'Some AI feature tables are missing.'

    return NextResponse.json(results)

  } catch (error: any) {
    return NextResponse.json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
