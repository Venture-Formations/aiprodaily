import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ImageMatcher } from '@/lib/article-modules'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: issueId } = await params

  // Get issue's publication_id
  const { data: issue, error: issueError } = await supabaseAdmin
    .from('publication_issues')
    .select('id, publication_id')
    .eq('id', issueId)
    .single()

  if (issueError || !issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  // Get all active article modules for this publication
  const { data: modules } = await supabaseAdmin
    .from('article_modules')
    .select('id, name')
    .eq('publication_id', issue.publication_id)
    .eq('is_active', true)

  if (!modules || modules.length === 0) {
    return NextResponse.json({ message: 'No active article modules', results: [] })
  }

  const results = []
  for (const mod of modules) {
    const result = await ImageMatcher.attachTradeImages(issueId, mod.id, issue.publication_id)
    results.push({ module: mod.name, moduleId: mod.id, ...result })
  }

  return NextResponse.json({
    success: true,
    results
  })
}
