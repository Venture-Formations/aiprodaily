import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/newsletters/by-subdomain?subdomain=accounting
 * Fetch newsletter by subdomain
 */
export const GET = withApiHandler(
  { authTier: 'public', logContext: 'newsletters-by-subdomain' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const subdomain = searchParams.get('subdomain')

    if (!subdomain) {
      return NextResponse.json(
        { success: false, error: 'Missing subdomain parameter' },
        { status: 400 }
      )
    }

    const { data: newsletter, error } = await supabaseAdmin
      .from('publications')
      .select('*')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Newsletter not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      newsletter
    })
  }
)
