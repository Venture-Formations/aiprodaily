import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const slugSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
})

type SlugInput = z.infer<typeof slugSchema>

export const GET = withApiHandler<SlugInput>(
  { authTier: 'authenticated', inputSchema: slugSchema, logContext: 'publications/check-slug' },
  async ({ input }) => {
    const { data } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', input.slug)
      .maybeSingle()

    return NextResponse.json({ available: !data })
  }
)
