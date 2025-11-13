import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Check total prompts
    const { data: allPrompts, count: totalCount } = await supabaseAdmin
      .from('prompt_ideas')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Check active prompts
    const { data: activePrompts, count: activeCount } = await supabaseAdmin
      .from('prompt_ideas')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Check newsletter assignment
    const { data: newsletterPrompts, count: newsletterCount } = await supabaseAdmin
      .from('prompt_ideas')
      .select('*, newsletter:newsletters(name)', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Check recent prompt selections
    const { data: recentSelections } = await supabaseAdmin
      .from('issue_prompt_selections')
      .select('*, prompt:prompt_ideas(title), issue:publication_issues(date)')
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      total_prompts: totalCount,
      active_prompts: activeCount,
      newsletter_assigned_prompts: newsletterCount,
      sample_active_prompts: activePrompts?.slice(0, 5).map(p => ({
        id: p.id,
        title: p.title,
        is_active: p.is_active,
        publication_id: p.publication_id
      })),
      newsletter_prompts_detail: newsletterPrompts?.slice(0, 5).map(p => ({
        id: p.id,
        title: p.title,
        newsletter_name: (p as any).newsletter?.name
      })),
      recent_selections: recentSelections?.map(s => ({
        issue_date: (s as any).issue?.date,
        prompt_title: (s as any).prompt?.title,
        created_at: s.created_at
      }))
    })

  } catch (error) {
    console.error('Error checking prompts:', error)
    return NextResponse.json({
      error: 'Failed to check prompts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
