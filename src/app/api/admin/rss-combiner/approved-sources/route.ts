import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'
import { invalidateCache } from '@/lib/rss-combiner'

const COLUMNS = 'id, source_name, source_domain, is_active, created_at' as const

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/approved-sources' },
  async () => {
    const { data, error } = await supabaseAdmin
      .from('congress_approved_sources')
      .select(COLUMNS)
      .order('source_name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ approvedSources: data })
  }
)

const postSchema = z.object({
  source_name: z.string().min(1).max(200),
  source_domain: z.string().min(1).max(200),
})

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/approved-sources', inputSchema: postSchema },
  async ({ input }) => {
    const { data, error } = await supabaseAdmin
      .from('congress_approved_sources')
      .insert({ source_name: input.source_name, source_domain: input.source_domain })
      .select(COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Source domain already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    return NextResponse.json({ approvedSource: data })
  }
)

const deleteSchema = z.object({
  id: z.string().uuid(),
})

export const DELETE = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/approved-sources', inputSchema: deleteSchema },
  async ({ input }) => {
    const { error } = await supabaseAdmin
      .from('congress_approved_sources')
      .delete()
      .eq('id', input.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    return NextResponse.json({ success: true })
  }
)

const patchSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
})

export const PATCH = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/approved-sources', inputSchema: patchSchema },
  async ({ input }) => {
    const { data, error } = await supabaseAdmin
      .from('congress_approved_sources')
      .update({ is_active: input.is_active })
      .eq('id', input.id)
      .select(COLUMNS)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    return NextResponse.json({ approvedSource: data })
  }
)
