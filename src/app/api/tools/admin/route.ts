import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

export async function GET(request: NextRequest) {
  // Check if staging environment (bypass auth)
  const host = request.headers.get('host') || ''
  const isStaging = host.includes('localhost') ||
                    host.includes('staging') ||
                    process.env.VERCEL_GIT_COMMIT_REF === 'staging'

  if (!isStaging) {
    // Check admin authentication in production
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedEmails = process.env.ALLOWED_ADMIN_EMAILS?.split(',') || []
    if (!allowedEmails.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const status = request.nextUrl.searchParams.get('status') || 'pending'

  let query = supabaseAdmin
    .from('tools_directory')
    .select(`
      *,
      directory_categories_tools(
        category:directory_categories(id, name, slug)
      )
    `)
    .eq('publication_id', PUBLICATION_ID)
    .order('created_at', { ascending: false })

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: tools, error } = await query

  if (error) {
    console.error('[Tools Admin] Error fetching tools:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform the data
  const transformedTools = (tools || []).map(tool => ({
    ...tool,
    categories: tool.directory_categories_tools?.map((ct: any) => ct.category).filter(Boolean) || []
  }))

  return NextResponse.json({ success: true, tools: transformedTools })
}
