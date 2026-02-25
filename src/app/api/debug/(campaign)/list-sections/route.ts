import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(campaign)/list-sections' },
  async () => {
    const { data: sections, error } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      sections: sections || [],
      total: sections?.length || 0
    })
  }
)
