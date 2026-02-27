import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/publications/by-domain?domain=example.com
 * Lightweight domain lookup for middleware (Edge-compatible consumer).
 * Public auth tier — middleware can't send session headers.
 */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get('domain')

  if (!domain) {
    return NextResponse.json({ publication: null }, { status: 400 })
  }

  // Strip port number if present (local development)
  const cleanDomain = domain.split(':')[0]

  // Try exact match
  const { data } = await supabaseAdmin
    .from('publications')
    .select('id, slug, subdomain')
    .eq('website_domain', cleanDomain)
    .eq('is_active', true)
    .maybeSingle()

  if (data) {
    return NextResponse.json({ publication: { id: data.id, slug: data.slug } })
  }

  // Try www variant
  const altDomain = cleanDomain.startsWith('www.')
    ? cleanDomain.replace('www.', '')
    : `www.${cleanDomain}`

  const { data: altData } = await supabaseAdmin
    .from('publications')
    .select('id, slug, subdomain')
    .eq('website_domain', altDomain)
    .eq('is_active', true)
    .maybeSingle()

  if (altData) {
    return NextResponse.json({ publication: { id: altData.id, slug: altData.slug } })
  }

  return NextResponse.json({ publication: null })
}
