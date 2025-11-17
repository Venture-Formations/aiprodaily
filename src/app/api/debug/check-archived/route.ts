import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  // Get all archived newsletters with their publication_id
  const { data: archived, error } = await supabaseAdmin
    .from('archived_newsletters')
    .select('id, issue_id, issue_date, publication_id, subject_line, send_date')
    .order('issue_date', { ascending: false })
    .limit(30)

  // Get distinct publication_ids
  const publicationIds = Array.from(new Set(archived?.map(a => a.publication_id) || []))

  return NextResponse.json({
    totalNewsletters: archived?.length || 0,
    distinctPublicationIds: publicationIds,
    error: error?.message,
    newsletters: archived?.map(a => ({
      id: a.id,
      issue_id: a.issue_id,
      issue_date: a.issue_date,
      publication_id: a.publication_id,
      send_date: a.send_date,
      subject_line: a.subject_line?.substring(0, 50)
    }))
  })
}
