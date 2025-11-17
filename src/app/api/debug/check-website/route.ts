import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPublicationByDomain } from '@/lib/publication-settings'

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get('domain') || 'www.aiaccountingdaily.com'

  // Get publication ID by domain
  const publicationId = await getPublicationByDomain(domain)

  // Get all publications to see what domains are configured
  const { data: pubs } = await supabaseAdmin
    .from('publications')
    .select('id, slug, name, website_domain, is_active')

  // Get archived newsletters count for this publication
  const { data: archived, count } = await supabaseAdmin
    .from('archived_newsletters')
    .select('id, publication_id, issue_date', { count: 'exact' })
    .eq('publication_id', publicationId || '')
    .order('issue_date', { ascending: false })
    .limit(5)

  // Get total archived newsletters (all publications)
  const { count: totalCount } = await supabaseAdmin
    .from('archived_newsletters')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    domain,
    publicationId,
    publications: pubs,
    archivedNewslettersForPublication: {
      count,
      recent: archived
    },
    totalArchivedNewsletters: totalCount
  })
}
